# GPU MODE Track 3 — Triton, Compilers & Kernel DSLs

One level above raw CUDA: writing kernels as operations on *tiles* (Triton, Gluon, Mosaic GPU), what a kernel compiler does with them (Triton → MLIR → PTX → cubin), and how kernels get packaged and shipped. Assumes [Track 1 — CUDA Foundations](./GPU-01-CUDA-Foundations.md).

## Contents

- [Lecture 10 — Build a Prod-Ready CUDA Library](#lecture-10--build-a-prod-ready-cuda-library)
- [Lecture 14 — Practitioner's Guide to Triton](#lecture-14--practitioners-guide-to-triton)
- [Bonus Lecture — CUDA C++ llm.cpp](#bonus-lecture--cuda-c-llmcpp)
- [Lecture 28 — Liger Kernel](#lecture-28--liger-kernel)
- [Lecture 29 — Triton Internals](#lecture-29--triton-internals)
- [Lecture 42 — Mosaic GPU](#lecture-42--mosaic-gpu)
- [Lecture 79 — Mirage (MPK): Compiling LLMs into Mega Kernels](#lecture-79--mirage-mpk-compiling-llms-into-mega-kernels)
- [Lecture 104 — Gluon: Tile-Based GPU Programming with Low-Level Control](#lecture-104--gluon-tile-based-gpu-programming-with-low-level-control)
- [Lecture 106 — HF Kernels](#lecture-106--hf-kernels)
- [Track summary](#track-summary)

---

## Lecture 10 — Build a Prod-Ready CUDA Library

**Slides:** [external](https://drive.google.com/drive/folders/158V8BzGj-IkdXXDAdHPNwUzDLNmr971_?usp=drive_link)

- **A library is an API contract, not a bag of kernels.** Users compose ops (`resize → convert → normalize`); the library turns that into as few memory round-trips as possible.
- **Vertical fusion:** chained element-wise ops read `x` once and write `y` once, keeping intermediates in registers. For memory-bound chains, fusing *N* ops can approach an *N*-fold cut in traffic.
- **Horizontal fusion:** many independent small problems in one launch (`blockIdx.z` or a lookup table picks the problem). Fixes under-occupancy and launch overhead.
- **Compile-time composition:** ops as types chained through variadic templates, so the compiler inlines the whole pipeline into one `__global__`. Cost: long compiles, big binaries, no runtime composition.
- **Separate "what" from "how":** read/write ops (indexing, layout) are decoupled from compute ops, so one compute chain runs over planar, interleaved, pitched or batched data.
- **Production concerns:** stable ABI, CUDA/compute-capability matrix, caller-provided streams (no implicit sync), error checks on every call, tests against a reference.

## Lecture 14 — Practitioner's Guide to Triton

**Slides:** video only · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_014)

- **Escalation ladder:** (1) `torch.compile`; (2) make code more `torch.compile`-friendly; (3) custom Triton for slow parts; (4) custom CUDA for what is still slow. CUDA = full control, max ceiling; Triton = easier, may not hit the absolute max.
- **One-level decomposition:** Triton splits work only into programs (blocks); each operates on *tiles*. No threads or shared memory to manage. `tl.program_id(axis)` replaces `blockIdx`.
- **Everything is vectorized**, including bounds checks: `mask = offs < n` passed to `tl.load`/`tl.store`. 2D tiles via broadcasting: `offs_0[:, None] * stride_0 + offs_1[None, :] * stride_1`.
- **`tl.constexpr` tile sizes:** each distinct value triggers a separate compilation.
- **Debug on CPU:** `TRITON_INTERPRET=1` (set before importing triton) runs kernels in a simulator so `print` and breakpoints work; some behaviour differs from GPU.
- **Matmul:** program `(pid_m, pid_n)` owns a `bm × bn` tile, loops over K with `acc += tl.dot(a, b)` into fp32 `tl.zeros`.
- **Launch order is your L2 knob.** Grouped order computes a square of output tiles together: in a 9×9-tile example, one row reads 90 distinct blocks, a 3×3 group reads 54. `tl.swizzle2d` remaps pids.
- **Autotuning:** `@triton.autotune(configs=[...], key=['m','n','k'])` benchmarks configs and caches the winner per key; `triton.testing.do_bench` for timing. The notebook's kernel stays slower than `torch.matmul`.

```python
@triton.jit
def copy_k(x_ptr, z_ptr, n, bs: tl.constexpr):
    pid  = tl.program_id(0)
    offs = pid * bs + tl.arange(0, bs)   # tile of indices
    mask = offs < n                       # tile of bools
    tl.store(z_ptr + offs, tl.load(x_ptr + offs, mask), mask)
```

## Bonus Lecture — CUDA C++ llm.cpp

**Slides:** [external](https://drive.google.com/drive/folders/1T-t0d_u0Xu8w_-1E5kAwmXNfF72x-HTA)

- **Premise:** rewrite `llm.c`'s hand-written GPT-2 kernels in *modern CUDA C++* from reusable, type-safe library pieces.
- **CCCL stack:** *Thrust* (STL-like device algorithms), *CUB* (warp/block/device primitives: `BlockReduce`, `BlockLoad`, `DeviceScan`), *libcu++* (`cuda::std::span`, `mdspan`, `atomic_ref`, `cuda::barrier`).
- **Primitives beat hand-rolled code:** `cub::BlockReduce` is tuned per architecture, correct for any block size, and updated for new hardware.
- **Types carry intent:** `span` carries a length, `mdspan` shape and strides, so indexing bugs become type/bounds errors instead of silent corruption.
- **Fusion via functors/lambdas:** pass an element-wise epilogue (GELU, residual add) into a reduction or transform instead of writing a new kernel.
- **Trade-off:** longer builds and worse error messages, in exchange for less code, fewer bugs, and performance that can match hand-written kernels.

## Lecture 28 — Liger Kernel

**Slides:** [external](https://docs.google.com/presentation/d/1CGTV-uKw9crrBo13q1jAzAFCFzlpZFjeL4bnK67pTd8/edit?usp=sharing)

- **What Liger is:** Triton kernels for RMSNorm, LayerNorm, RoPE, SwiGLU/GeGLU, CrossEntropy and FusedLinearCrossEntropy, monkey-patched into HF models (`apply_liger_kernel_to_llama()`).
- **Where memory goes:** with large vocabularies, the `[batch·seq, vocab]` logits (and gradient) often dominate peak memory.
- **FusedLinearCrossEntropy:** fuse `hidden @ W_lm_head` with the loss and process rows in chunks, backpropagating per chunk. Full logits are never stored; peak memory scales with chunk size.
- **In-place gradient:** `softmax(x) − onehot(y)` overwrites the logits buffer during forward.
- **Recompute vs store:** RMSNorm caches only per-row `rstd`; SwiGLU recomputes its activation in backward.
- **Correctness is the product:** op-level tests with dtype-aware tolerances *and* layer-by-layer convergence tests, because tiny differences compound.
- **Hazards:** non-contiguous inputs silently break `row * n_cols + col` offsets (enforce contiguity at the boundary); int32 offsets overflow past 2³¹ elements, so use `pid.to(tl.int64) * stride`.

## Lecture 29 — Triton Internals

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L029-Triton-Internals.pdf) · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_029)

- **Pipeline:** Python DSL → **TTIR** → **TTGIR** → **LLIR** → **PTX** → **cubin**, plus a generated C launcher. Cached in `~/.triton/cache/<hash>/` (`TRITON_CACHE_DIR`).
- **Inspect:** `compiled_kernel.asm` holds `ttir/ttgir/llir/ptx/cubin`; the cubin is ELF, so `cuobjdump -sass` and `nvdisasm` work. `MLIR_ENABLE_DUMP=1` dumps IR after every pass.
- **Built on MLIR (since 2022):** dialects (`tt`, `triton_gpu`, `triton_nvidia_gpu`) declared in TableGen, plus reused generic passes (SCCP, DCE, inliner, canonicalizer, CSE, LICM).
- **Triton-dialect passes** (hardware-agnostic): Combine (`dot(a,b,0)+c → dot(a,b,c)`), ReorderBroadcast, RewriteTensorPointer, LoopUnroll.
- **TritonGPU passes:** coalescing, remove-layout-conversions, **accelerate-matmul** (`tt.dot` → tensor-core MMA via a `BlockedToMMA` rewrite), and software **pipelining** with `num_stages` on capability ≥ 8.0.
- **Layouts are the key TTGIR concept:** `#blocked<{sizePerThread=[4], threadsPerWarp=[32], warpsPerCTA=[4]}>` covers 512 elements per sweep, so a 1024 tile gives each thread 2 chunks. This is where L14's "missing" thread mapping lives.
- **`tt.divisibility = 16`** argument hints enable vectorized 128-bit loads.
- **AOT:** `tools/compile.py` emits a `.c/.h` with the cubin embedded, callable with no Python at runtime, but the specialization is fixed.

## Lecture 42 — Mosaic GPU

**Slides:** video only

- **Where it sits:** JAX's kernel language Pallas has backends Mosaic TPU, Triton, and **Mosaic GPU**, an MLIR backend targeting Hopper+ directly.
- **Why another DSL:** Hopper/Blackwell speed depends on async hardware (TMA, `wgmma`, mbarriers, clusters). Block-level compilers must *infer* the pipeline; Mosaic GPU makes it explicit while staying array-level.
- **Explicit memory spaces:** GMEM → SMEM via TMA with barriers, SMEM → tensor cores via WGMMA, accumulators in registers; you choose buffering depth and when to wait.
- **Pipelining as a library:** `emit_pipeline`-style helpers generate prologue/steady state/epilogue from a one-step body.
- **Warp specialization:** producer warps issue TMA, consumer warpgroups issue MMAs, synced by barriers.
- **Trade-off:** less portable and more verbose than Triton, but the author controls the schedule.

## Lecture 79 — Mirage (MPK): Compiling LLMs into Mega Kernels

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L079-Mirage.pdf)

- **Problem:** device memory ~1 TB/s, shared ~10 TB/s, registers ~100 TB/s, yet frameworks launch one kernel per operator, missing **fusion, algebraic transformations and on-chip reuse**.
- **µGraphs:** a multi-level representation mirroring the hardware: kernel graph → thread-block graphs (iterators, smem ops, accumulators) → thread graphs (register ops). Rule-based rewriting fails because fused kernels have no common rules.
- **Generator → Verifier → Optimizer.** Exhaustive search over bounded-size µGraphs, pruned by **abstract expressions** (e.g. a K=64 matmul is `Σ₆₄ ab`) checked by a theorem prover.
- **Probabilistic verification over finite fields:** exact arithmetic means equal graphs always match and a mismatch proves inequivalence; repeated random tests give high confidence.
- **Optimizer:** layouts, memory planning and scheduling don't change outputs, so they're solved after search, keeping the search space small.
- **Results (as presented):** up to 3.3× on H100 vs best of cuDNN/cuBLAS/FlashAttention/TensorRT/Triton/TVM; finds a GPC-level AllReduce µGraph reported 2.2× faster.
- **MPK mega-kernel (public project, not in slides):** the whole forward as one persistent kernel, with operators split into SM-sized *tasks* and an in-kernel worker/scheduler runtime. Removes launch gaps; biggest gains in small-batch decoding.

## Lecture 104 — Gluon: Tile-Based GPU Programming with Low-Level Control

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L104-Gluon.pdf)

- **Why Triton isn't enough on Blackwell:** the fast schedule is **warp-specialized** (separate load, MMA, epilogue warps), which mismatches the block model, so "the compiler may miss the best schedule".
- **Gluon:** Triton's frontend and stack, lower level, aiming at SOL. Triton ~80%+ SOL with hidden layouts; Gluon SOL with explicit Linear Layouts, but not portable and harder to write.
- **Explicit control:** distributed layouts on `gl.arange`, `gl.convert_layout`, statically allocated swizzled shared memory, `gl.warp_specialize` as fork-join, and first-class `mbarrier`, `tma.async_load`, `tcgen05_mma`. The compiler still expands ops and inserts `bar.sync`/fences.
- **Linear Layouts:** a layout maps (register, lane, warp) to tensor coords as a binary matrix over 𝔽₂ (XOR as addition). Blocked, MMA, sliced and swizzled layouts are all special cases.
- **What they bought:** fixed "the source of most of previous bugs in Triton"; the compiler derives optimal swizzles and shuffle sequences for any layout pair, reproducing FA3's hand-tuned shuffles.
- **Blackwell GEMM:** `tcgen05.mma` with accumulator in **TMEM**, 2-CTA mode sharing B tiles, TMA multicast, Cluster Launch Control for dynamic tile stealing in persistent kernels. Result: on par with cuBLAS on B200 (within ~1%).
- **Tooling:** Proton profiler; sanitizers `consan` (in-program races), `iisan` (misaligned TMA), `fpsan` (exact reordering checks), `gsan` (cross-CTA global races).

## Lecture 106 — HF Kernels

**Slides:** [external](https://docs.google.com/presentation/d/1RibAIrOJv0BcAx2QjNYHDZCrMfGYifTggtKT6uwv7CY/edit)

- **The distribution problem:** custom kernels need compiling against an exact torch/CUDA/compiler combo, with ABI mismatches keeping them out of most projects.
- **Kernels as Hub artifacts:** `get_kernel("kernels-community/activation")` downloads a precompiled build matching your environment.
- **Build matrix:** Nix-based `kernel-builder` builds every torch × CUDA/ROCm × arch combination ahead of time.
- **Compliance:** stable ABI where possible, no system deps beyond torch, ops registered via `torch.library` (so `torch.compile` doesn't graph-break), tests shipped.
- **Layer swapping:** `@use_kernel_forward_from_hub("RMSNorm")` + `kernelize(model, mode=...)` swaps in Hub kernels, with PyTorch fallback.
- **Pinning:** by Hub revision or lock file, like model weights.

---

## Track summary

| Concept | Lecture | Takeaway |
|---|---|---|
| Vertical / horizontal fusion | 10 | Fuse chains to cut HBM traffic; batch small problems into one launch |
| CCCL | Bonus | Tuned CUB/Thrust primitives and typed views over hand-rolled loops |
| Tile programming | 14 | A program owns a tile; `tl.arange` + masks replace `threadIdx` + `if` |
| Grouped launch order | 14 | Group output tiles for L2 reuse (`swizzle2d`) |
| Autotuning | 14 | Benchmarks configs per `key`, caches the winner |
| Fused chunked loss | 28 | Linear + cross-entropy without materializing logits |
| Production hazards | 28 | Non-contiguity and int32 overflow fail silently |
| Compile pipeline | 29 | TTIR → TTGIR → LLIR → PTX → cubin, MLIR passes do the work |
| Layout encodings | 29, 104 | Thread mapping lives in layouts, explicit in TTGIR and Gluon |
| Explicit async DSLs | 42, 104 | TMA + mbarrier + MMA + warp specialization must be exposed on Hopper+ |
| Superoptimization / mega-kernels | 79 | Search µGraphs, verify over finite fields; persistent task-graph kernels |
| Linear layouts (𝔽₂) | 104 | Layouts as binary matrices make conversions and swizzles linear algebra |
| Kernel distribution | 106 | Prebuilt build matrix on the Hub; swap layers with `kernelize` |

## Next

[Track 4 — CUTLASS, CuTe & Tensor Cores →](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md)
