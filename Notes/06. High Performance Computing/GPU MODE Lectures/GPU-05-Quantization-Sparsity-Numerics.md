# GPU MODE Track 5 — Quantization, Sparsity & Numerics

Making models cheaper with fewer bits per value (quantization), skipping work on zeros (sparsity), and understanding what finite precision does to results (numerics). The common trade-off: lower precision cuts memory, bandwidth and silicon per op, but every bit removed is paid for with scale factors, special kernels, or accuracy-recovery tricks.

## Contents

- [Number formats primer](#number-formats-primer)
- [Lecture 7 — Advanced Quantization](#lecture-7--advanced-quantization)
- [Lecture 11 — Sparsity](#lecture-11--sparsity)
- [Lecture 30 — Quantized Training](#lecture-30--quantized-training)
- [Lecture 33 — BitBLAS](#lecture-33--bitblas)
- [Lecture 34 — Low-Bit Triton Kernels](#lecture-34--low-bit-triton-kernels)
- [Lecture 38 — Low-Bit Kernels for ARM CPU](#lecture-38--low-bit-kernels-for-arm-cpu)
- [Lecture 69 — Quartet: 4-bit Training](#lecture-69--quartet-4-bit-training)
- [Lecture 84 — Numerics and AI](#lecture-84--numerics-and-ai)
- [Track summary](#track-summary)
- [Next](#next)

## Number formats primer

`ExMy` = 1 sign bit, x exponent bits (**range**), y mantissa bits (**precision**).

| Format | Bits | Sign / exp / mantissa | Max normal (approx.) | Typical use |
|---|---|---|---|---|
| FP32 | 32 | 1 / 8 / 23 | 3.4e38 | Master weights, optimizer state, accumulators |
| TF32 | 19 (stored in 32) | 1 / 8 / 10 | same range as FP32 | Tensor Core input mode for FP32 matmuls (Ampere+) |
| BF16 | 16 | 1 / 8 / 7 | same range as FP32 | Default training/inference dtype; no loss scaling needed |
| FP16 | 16 | 1 / 5 / 10 | 65504 | Older mixed-precision training (needs loss scaling), inference |
| FP8 E4M3 (OCP "FN") | 8 | 1 / 4 / 3 | 448 | Weights/activations; no infinities, single NaN pattern |
| FP8 E5M2 | 8 | 1 / 5 / 2 | 57344 | Gradients in classic per-tensor FP8 training |
| MXFP4 (OCP MX) | 4 + shared scale | E2M1 elements, 32-element block, E8M0 (power-of-two) scale | 6 × scale | Blackwell / MI-class block-scaled FP4 |
| NVFP4 | 4 + shared scales | E2M1 elements, 16-element block, E4M3 block scale (+ FP32 per-tensor scale) | 6 × scale | NVIDIA Blackwell FP4 inference and training |
| INT8 | 8 | two's complement | 127 (min -128) | PTQ weights/activations, `IMMA` / `DP4A` |
| INT4 | 4 | two's complement | 7 (min -8) | Weight-only quantization (W4A16), packed 2 per byte |

E2M1 represents only {0, 0.5, 1, 1.5, 2, 3, 4, 6}, so every FP4 format is a *block* format: the scale does the heavy lifting on range.

Affine quantization: `w ≈ s · (q − z)`; symmetric `s = amax / qmax, z = 0`. Scale granularity: per-tensor → per-row/channel → per-group (32/64/128) → per-block. Finer = more accurate, more metadata, harder kernels.

---

## Lecture 7 — Advanced Quantization

**Slides:** [external](https://www.dropbox.com/scl/fi/hzfx1l267m8gwyhcjvfk4/Quantization-Cuda-vs-Triton.pdf?rlkey=s4j64ivi2kpp2l0uq8xjdwbab&dl=0)

- Batch-1 decode is a GEMV, so it is **memory-bandwidth bound**: halving bytes per weight roughly halves time per token, even if math stays in BF16/FP16.
- Three PTQ flavours: *weight-only* (W8A16, W4A16; wins when memory-bound), *dynamic W8A8* (runtime per-token activation scales, integer Tensor Cores; wins when compute-bound: prefill, large batch), *static W8A8* (offline calibration; cheapest, most accuracy risk).
- **Dequantize must be fused** into the matmul (registers/shared memory); a separate dequant → HBM → matmul round-trip throws away the bandwidth saved.
- int8 dynamic matmul: `Y = (X_q @ W_q) * s_x[:, None] * s_w[None, :]` — row scale on X, column scale on W factor out of the K-loop, applied once in the epilogue.
- int4: two values per byte, unpacked with shifts/masks, per-group scale/zero (group 64/128 along K) is the accuracy knob. Hand-written CUDA/CUTLASS beats Triton here, where layout and register pressure dominate.
- Best kernel depends on M: small M favours weight-only, large M favours W8A8.
- torchao represents quantized weights as a `torch.Tensor` subclass overriding `F.linear`, so model code is unchanged and `torch.compile` traces through it.

---

## Lecture 11 — Sparsity

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L011-Sparsity.pdf)

- Two halves: *accuracy* (which weights can be zeroed) and *performance* (zeros only help if the kernel skips them).
- Pattern spectrum, flexibility vs structure:

  | Pattern | Accuracy | GPU speed |
  |---|---|---|
  | Unstructured | Best | COO/CSR only wins at very high sparsity (>99%) |
  | Structured (rows/channels) | Hard to recover | Reuses dense kernels on a smaller matrix |
  | Semi-structured 2:4 | Relatively easy to recover | Fixed 50%; hardware support; ≤ 2× theoretical |
  | Block | Needs advanced recovery (Superblock, DRESS) | ~3.4× at 90% on microbenchmarks |

- **2:4:** 2 of every 4 contiguous elements are zero; stored as 2 values + 2-bit indices; Sparse Tensor Cores (Ampere+). Theoretical 2×, ~1.6× average in practice. Backends: cuSPARSELt, CUTLASS. API: prune, then `to_sparse_semi_structured(W)`.
- Only the first operand can be sparse, so `x @ W.T` becomes `(W @ x.T).T`; torch.compile fuses the transposes away.
- Block sparsity: ViT-L on ImageNet, 1.44× end-to-end with accuracy 78 → 76 (Superblock).
- **2:4 training:** sparsify at runtime each step; needs both `W` and `Wᵀ` compressed (transposed 2:4 is not 2:4). Compute-only benefit with ~9/8 memory penalty; DINO via xFormers saw 10–20% speedup, 81.6 → 80.5 accuracy. Inference sparsifies offline once and saves memory too.
- Accuracy is the stated main blocker; composing sparsity with quantization is an open problem.

---

## Lecture 30 — Quantized Training

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L030-Quantized-Training.pdf) · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_030)

- Training has more to quantize than inference: forward, backward, optimizer step; activations, gradients, parameters, optimizer state. Goals: save memory and go faster.
- **Low-bit optimizers:** Adam state for an 8B model is 64 GB in FP32, 32 GB BF16, 16 GB 8-bit, 8 GB 4-bit. Pattern `DQ(state) → FP32 math → Q(new state)`, fused in one kernel; dequantized state must never hit global memory, which forces small scale blocks.
- **Weight-update underflow:** `p − lr·update` rounds back to `p` for small updates (INT8: `1 + 0.1 = 1`). **Stochastic rounding** (round up with probability `x − ⌊x⌋`) gives `E[SR(x)] = x`, so small updates survive on average. Works for INT8 and BF16.
- Speaker's verdict on INT8 weight-only training: not yet attractive (less memory saved than ideal, slower, slightly less accurate); QLoRA is simpler for fine-tuning.
- **Low-bit mixed-precision for speed:** keep FP32 weights, dynamically quantize both matmul inputs in forward and backward. INT8/FP8 give 2× BF16 peak on A100/H100/GB200 (4× INT8 on a 4090); GB200 FP4 is 4×.
- Scaling by dtype: FP16 needs loss scaling, BF16 none, FP8 tensor-wise, INT8 row-wise (A) × column-wise (B).
- **Axis problem:** a row-wise W scale in the forward becomes a reduction-axis scale in `G_X = G_Y·W` and cannot be factored out; use tensor-wise scaling or re-quantize along the other axis.
- BitNet 1.58: ternary weights (abs-mean tensor scale) + INT8 per-token activations → INT8 Tensor Cores and a 2-bit FSDP all-gather.

```python
def sr(x):  # unbiased stochastic rounding
    rand = torch.rand(x.shape, device=x.device)
    return torch.where(rand < x - x.floor(), x.floor() + 1, x.floor())
```

---

## Lecture 33 — BitBLAS

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L033-BitBLAS.pdf)

- Problem: models go ever lower-bit (FP8, MXFP, INT4, FP4, INT1) but software lacks the types, hardware lacks mixed instructions (FP16×INT4), and every dtype × layout × arch combination needs a tuned kernel.
- **Memory is type-agnostic** (store any type as opaque bits); **compute is compatible** (most custom types convert losslessly to a wider supported type). Store narrow, compute wide.
- Ladder (OSDI '24, on TVM TensorIR) separates datatype from schedule via the **tTile** abstraction; BitBLAS is its kernel library. Naive compilers reach only 60–80% of cuBLAS because each memory level needs a different layout.
- **Layout propagation:** derive the ideal layout from the MMA/`ldmatrix` fragment and push it upstream instead of searching an O(N!) space; linear and compressed transforms propagate, non-injective ones (group scales) do not. Static weights get the reorder constant-folded.
- **Fast dequant via weight interleave:** a few bit-logic ops convert 8×int4 in a 32-bit register to 8×FP16 at once, instead of per-element shifts and converts.
- Only M is dynamic in LLMs: keep a kernel database per M range and dispatch at runtime. Decode is memory-bound (quantization wins directly); prefill only wins with a faster INT8/FP8 MMA.
- A100 results: W_INT4A_FP16 ~2.3× over vLLM's; W_INT1A_INT8 up to 8.8× over Ladder FP16 (BLOOM-176B, BS1). Limits (compile time, extensibility) led to TileLang.

---

## Lecture 34 — Low-Bit Triton Kernels

**Slides:** [external](https://docs.google.com/presentation/d/1R9B6RLOlAblyVVFPk9FtAq6MXR1ufj1NaT0bjjib7Vc/edit)

- Goal: fast `W_nbit × A_fp16` (n = 8, 4, 2, 1) in Triton: portable, hackable, `torch.compile`-friendly.
- **HQQ** is calibration-free: optimizes zero point (and optionally scale) on the weights alone, so it is fast and needs no data, unlike GPTQ/AWQ.
- Bit-packing (container, axis, order) decides how many shifts/masks are needed and whether unpacked values land in `tl.dot` order.
- Kernel depends on M: GEMV (M = 1, memory-bound, vectorized loads + split-K) vs tiled GEMM (compute-bound); libraries dispatch by M.
- In the K-loop: load packed tile → `(q >> shift) & mask` → `(q − z) * s` → `tl.dot` in FP16 with FP32 accumulate.
- Autotuning (blocks, warps, stages, split-K) is mandatory and should be cached; Triton's weak control of sub-byte layouts is the same pain point as Lecture 33.

---

## Lecture 38 — Low-Bit Kernels for ARM CPU

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L038-Lowbit-Kernels-ARM.pdf)

- torchao ARM ops: linear with 8-bit dynamic activations × 1–8-bit weights, plus low-bit embeddings; usable from eager, `torch.compile`, AOTI, ExecuTorch and torchchat.
- The FP32 dot product becomes an **integer dot product** of quantized values, with scales and zero-point corrections applied afterwards.
- Two levels: a multithreaded, kernel-agnostic operator over single-threaded vectorized micro-kernels, joined by a **ukernel config** of function pointers so vendors (e.g. KleidiAI) can plug in.
- "Universal" GEMV: unpack intX → int8, then an int8 matmul kernel; bitpacking routines and 24 GEMV kernels are swappable.
- **Bitpacking layout matters:** for 3-bit values one format unpacks 1.60× faster and gives 1.23× end-to-end decode speedup.
- Valpacking: store weights in the order the kernel consumes them, so every load is contiguous.

---

## Lecture 69 — Quartet: 4-bit Training

**Slides:** video only · [paper](https://arxiv.org/abs/2505.14669) · [Quartet](https://github.com/IST-DASLab/Quartet) · [qutlass](https://github.com/IST-DASLab/qutlass)

- Goal: *native* FP4 training — all major linear-layer matmuls, forward and backward, in MXFP4 on Blackwell Tensor Cores.
- Hard because E2M1 has 8 magnitudes: one outlier forces a large power-of-two block scale and crushes the rest to zero; gradients are heavy-tailed and biased rounding accumulates.
- Different error budgets: forward minimizes **MSE**; backward keeps gradients **unbiased** (variance is acceptable).
- Forward: **Hadamard rotation** spreads outliers across the block, then MSE-optimal clipping. Backward: randomized Hadamard + stochastic rounding.
- A scaling law treats precision as effective-parameter and effective-data multipliers: FP4 is worth it only if its speedup outweighs its effective loss versus FP8/BF16.
- QuTLASS fuses Hadamard, MXFP4 quantization and scale computation with the block-scaled MMA so the transforms do not eat the speedup.

---

## Lecture 84 — Numerics and AI

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L084-Numerics-and-AI.pdf)

- Precision = sample spacing; accuracy = closeness to truth. Integers sample uniformly; floats have 2^M samples per binade (FP16: 1024 between 0.25–0.5 and between 128–256).
- IEEE: bias `2^(E−1) − 1`, implicit leading 1; subnormals extend range downward with shrinking precision (FP16 reaches 2⁻²⁴). OCP E4M3 drops infinities and keeps one NaN, gaining max 448.
- FP16 training needed **loss scaling** (gradients fell below range); BF16's FP32-sized range removed it.
- FP8 range is ~32 binades (E5M2) and ~18 (E4M3) — too few for one scale across all tensors. Smaller blocks shrink the outlier "blast radius" but GEMMs prefer larger blocks.
- **OCP MX:** 32-element blocks with E8M0 scale, no GEMM slowdown on Blackwell/MI300-class. MXFP8 training can use E4M3 everywhere, including gradients.
- **Scale precision matters:** block amax 3.6 with E8M0 scale 1 decodes to 4 (top FP4 sample 6 unused); an E4M3 scale 1.625 maps it to 6, decoding to 3.6923.
- Integer calibration is network-dependent (99.99 percentile best for BERT-L, terrible for EfficientNet-b0).
- **Rounding causes FP quirks:** non-associativity (reduction order → run-to-run nondeterminism), swamping (E5M2: `32 + 3.5 = 32`), and FMA (`x·x − y·y` can be non-zero when x = y).

---

## Track summary

| Concept | Lecture | Takeaway |
|---|---|---|
| Weight-only vs W8A8 | 7, 30 | Weight-only wins when memory-bound (decode); W8A8 when compute-bound (prefill). |
| Fused dequant | 7, 33, 34 | Dequantize in registers inside the matmul, never via HBM. |
| Row × column scaling | 7, 30 | Scales that factor out of the K-sum keep the integer loop untouched. |
| 2:4 sparsity | 11 | Hardware 50% sparsity; ≤ 2× theoretical, ~1.6× typical. |
| Low-bit optimizer state | 30 | 8/4-bit Adam cuts memory 4–8× vs FP32 if DQ/Q is fused. |
| Stochastic rounding | 30, 69 | Unbiased rounding keeps small updates from vanishing. |
| Store narrow, compute wide | 33 | Custom types convert losslessly to supported types in registers. |
| Layout propagation | 33 | Derive layouts from MMA fragments instead of searching. |
| M-dependent dispatch | 33, 34 | GEMV and GEMM regimes need different kernels. |
| Bitpacking format | 34, 38 | Packing order decides unpack cost. |
| Hadamard rotation | 69, 84 | Spreads outliers so low-bit grids are used efficiently. |
| Range vs precision | 84 | Exponent bits buy binades, mantissa bits buy samples per binade. |
| Block-scaled formats | 69, 84 | Smaller blocks and more precise scales reduce error. |
| FP non-associativity | 84 | Summation order matters; source of nondeterminism. |

## Next

Continue with [GPU MODE Track 6 — Multi-GPU & Distributed](./GPU-06-Multi-GPU-Distributed.md).
