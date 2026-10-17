# GPU MODE Track 2 — Parallel Algorithms & Fused Kernels

Applies the Track 1 execution model to the patterns behind nearly every GPU workload: reductions, scans, tiled and distributed attention, and kernel fusion. The recurring theme: **reduce trips to HBM, keep threads converged, and restructure the math so partial results can be combined later**.

## Contents

- [Lecture 9 — Reductions](#lecture-9--reductions)
- [Lecture 12 — Flash Attention](#lecture-12--flash-attention)
- [Lecture 13 — Ring Attention](#lecture-13--ring-attention)
- [Lecture 18 — Fused Kernels](#lecture-18--fused-kernels)
- [Lecture 19 — Data Processing on GPUs](#lecture-19--data-processing-on-gpus)
- [Lectures 20 & 21 — Scan Algorithm (Parts 1–2)](#lectures-20--21--scan-algorithm-parts-12)
- [Lecture 24 — Scan at the Speed of Light](#lecture-24--scan-at-the-speed-of-light)
- [Track summary](#track-summary)

---

## Lecture 9 — Reductions

**Slides:** [external](https://docs.google.com/presentation/d/1s8lRU8xuDn-R05p1aSP6P7T5kk9VYnDOCyN5bWKeg3U/edit?usp=drive_link) · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_009)

- **A reduction is `(data, identity, op)`** — sum (0), product (1), max (−∞), min (+∞). Parallelizing needs `op` associative (regroup) and ideally commutative (reorder).
- **Float addition is not associative,** so GPU sums differ from a CPU loop, and run-to-run if grouping isn't fixed (e.g. `atomicAdd` order). In fp16, `1000 + 1e-3` is `1000.0`: accumulate in higher precision than you store.
- **Tree reduction:** O(N) work, O(log N) depth. The problem is which threads stay active and where partials live.
- **Divergent → convergent:** `threadIdx.x % stride == 0` scatters active lanes across all warps; `threadIdx.x < stride` (stride halving) packs them so whole warps retire and loads coalesce.
- **Shared memory:** first step reads global, the rest hit shared. It was not measurably faster on the author's setup despite higher L1 throughput: profile, don't assume.
- **Multi-block:** each block reduces its segment, then thread 0 does one `atomicAdd` per block (cheap, but order-dependent).
- **Thread coarsening:** each thread serially sums `COARSE_FACTOR` elements in registers first, giving fewer blocks, barriers and atomics. The same hierarchy extends to multiple devices: thread → block → grid → device → host.

```cuda
for (unsigned stride = blockDim.x / 2; stride > 0; stride >>= 1) {
    if (t < stride) input_s[t] += input_s[t + stride];
    __syncthreads();
}
if (t == 0) atomicAdd(output, input_s[0]);
```

---

## Lecture 12 — Flash Attention

**Slides:** video only · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_012)

- **The problem:** naive attention writes and reads the N×N score matrix to HBM, so traffic and footprint are O(N²) though the output is N×d.
- **Tiling:** split Q/O into `B_r`-row blocks and K/V into `B_c`-row blocks; stream each `(K_j, V_j)` through shared memory and fold `S_ij` into the output immediately. `S` never exists in full.
- **Online softmax makes tiling legal:** keep running max `m` and denominator `l`; when the max rises, rescale accumulated state by `exp(m_old − m_new)`. Divide by `l` only at the end.
- **LSE output** `L = m + log(l)` per row is needed for backward and for merging attention over different key blocks (Lecture 13).
- **Distribute accumulators, don't replicate them.** Each thread owns a small slice of `O_i` so state stays in registers. Full per-thread arrays spill (`__local_depot` in PTX): 13.02 ms vs 2.10 ms non-spilling.
- **Parallelism:** the query-tile loop runs across blocks; the K/V loop is sequential within a block because of the running `m`/`l` dependency.
- **Teaching kernel only:** fp32 CUDA-core FMAs, no tensor cores; comparable to SDPA only for small matrices.

```python
m_new = max(m_old, S_ij.max(-1));  P = exp(S_ij - m_new)
l_i = exp(m_old - m_new) * l_i + P.sum(-1)
O_i = exp(m_old - m_new) * O_i + P @ V_j      # finally: O_i /= l_i
```

---

## Lecture 13 — Ring Attention

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L013-Ring-Attention.pdf) · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_013)

- **Long context runs out of memory, not just FLOPs.** 100M tokens at hidden size 1024 would need over 1000 GB; FlashAttention removes O(N²) scores, but activations still scale linearly on one device.
- **FLOPs per token** `24·s·h² + 4·s²·h`: the quadratic term eventually dominates, but later than intuition suggests for large h.
- **Softmax is the crux:** keys split across devices require merging partial softmaxes. Use log-sum-exp and only exponentiate differences, never raw values.
- **Outputs merge with the same LSE weights** because `P·V` is linear in `P`; the merge is order-independent up to rounding.
- **Ring:** split Q/K/V along the sequence; each device keeps its Q and passes K/V around a ring. After N−1 hops every Q has seen every K/V. If per-block compute ≥ transfer time, communication is hidden.
- **Causal masking breaks load balance** with contiguous chunks; **Striped Attention** assigns tokens round-robin so every device gets a near-identical triangular workload.
- **Flash-Decoding:** with one query row at decode time, split the keys across thread blocks and merge with LSE.

```python
new_lse = lse + torch.log(1 + torch.exp(block_lse - lse))
out     = torch.exp(lse - new_lse) * out + torch.exp(block_lse - new_lse) * block_out
```

---

## Lecture 18 — Fused Kernels

**Slides:** video only · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_018)

- **Why fuse:** each eager op is an HBM round trip plus a launch. A fused kernel reads inputs once, keeps intermediates in registers, writes once.
- **Workload:** Meta's DLRM on Criteo data (dense features → bottom MLP, sparse → embeddings, dot-product interaction, top MLP).
- **Profile first:** `Tensor.item()` looked dominant because it is a sync point absorbing queued work; `CUDA_LAUNCH_BLOCKING=1` attributed time to the real culprit, a host-side index hash rebuilt from a Python list every forward.
- **`torch.compile` as fusion engine:** higher GPU utilization, lower memory. `TORCH_LOGS=output_code` shows Inductor's Triton (`fused_relu`, `fused_cat`, ...); readable enough to learn Triton from.
- **Triton ↔ CUDA mapping:** program ↔ block, `arange` ↔ `threadIdx`, mask ↔ `if`. `eviction_policy='evict_last'` keeps a reused bias in cache.
- **LoRA case:** Inductor fuses epilogue `add + mul + relu`/`sigmoid`; matmuls stay library calls. A `tl.constexpr` activation removes the branch at compile time.
- **Limits:** fusing across a matmul changes the data each block needs, so whole-MLP fusion requires careful tiling.

---

## Lecture 19 — Data Processing on GPUs

**Slides:** video only

- **Analytics is bandwidth-bound:** few ops per byte, so HBM bandwidth and keeping data on device matter more than FLOPs; PCIe/NVLink and file decoding become the bottleneck.
- **Columnar (Arrow-style) layout** gives coalesced access, touches only needed columns, maps one thread to one row.
- **Built from this track's primitives:** filter = flags → exclusive scan → scatter; group-by = sort/hash + segmented reduction; string offsets = prefix sum of lengths; join = hash build/probe or sort-merge.
- **GPU hash tables:** open addressing with atomic CAS; skewed keys create contention hotspots.
- **Variable-width data and decoding** (Parquet/ORC) use two passes: count + scan for output positions, then fill.
- **Out-of-core / multi-GPU:** chunked streaming, spilling to host, or partitioning with an all-to-all shuffle.

---

## Lectures 20 & 21 — Scan Algorithm (Parts 1–2)

**Slides:** [external](https://docs.google.com/presentation/d/1MEMsE5LKi6ush_60hlYu3-cz4DUCFzSL/edit?usp=sharing&ouid=106222972308395582904&rtpof=true&sd=true)

- **Definition:** inclusive `y[i] = x[0] ⊕ … ⊕ x[i]`; exclusive shifts by one with the identity first. Needs associative `⊕`. Underlies compaction, radix sort, CSR and string offsets.
- **Kogge–Stone:** log₂N steps but ~N·log₂N work (not work-efficient); low latency; needs double buffering in shared memory.
- **Brent–Kung:** up-sweep + down-sweep, ~2N work in 2·log₂N steps. Pick Kogge–Stone when latency matters, Brent–Kung when work does.
- **Coarsened three-phase block scan:** per-thread serial scan → block scan of thread totals → add preceding total. Work-efficient, best per-block in practice.
- **Hierarchical multi-block scan:** scan blocks → scan block totals → add prefixes. Simple, but ~3N–4N memory traffic.
- **Single-pass chained scan:** each block waits on its predecessor's prefix. ~2N traffic, but needs atomic dynamic block IDs (avoid deadlock) and memory fences; the serial wait chain is the remaining bottleneck.
- **Segmented scan** lifts `⊕` to `(flag, value)` pairs: the basis of group-by and sparse ops.

| Algorithm | Steps | Work |
| --- | --- | --- |
| Kogge–Stone | log₂N | ~N log₂N |
| Brent–Kung | 2 log₂N | ~2N |
| Hierarchical (3 kernels) | 3 launches | ~N, ~3–4N memory |
| Single-pass chained | 1 launch | ~N, ~2N memory |

---

## Lecture 24 — Scan at the Speed of Light

**Slides:** video only

- **Speed of light = memory bandwidth:** floor is `2N·sizeof(T) / peak_bandwidth`; a good scan matches a `cudaMemcpy` of the same data.
- **Chained scan misses it** because prefixes propagate serially across thousands of blocks.
- **Decoupled look-back:** each tile publishes `A` (own aggregate) immediately, then looks back summing aggregates until it hits a `P` (inclusive prefix), then publishes its own `P`.
- **Flag + value in one atomic 64/128-bit word** avoids a separate fence between data and flag.
- **Warp-cooperative look-back** inspects 32 predecessors per step; large coarsened tiles amortize the look-back cost.
- **Use the library:** `cub::DeviceScan::InclusiveSum`/`ExclusiveSum` (and `thrust::inclusive_scan`). Works for any associative operator, including linear recurrences.

---

## Track summary

| Concept | Lecture | Takeaway |
| --- | --- | --- |
| Tree reduction | 9 | O(N) work, O(log N) depth; float non-associativity makes order visible. |
| Convergent indexing | 9 | `t < stride` keeps active threads contiguous so warps retire. |
| Thread coarsening | 9, 20/21, 24 | Serial work in registers first; excess parallelism is overhead. |
| Online softmax | 12 | Running `m`, `l`, rescaled by `exp(m_old − m_new)`, make attention tileable. |
| Register spilling | 12 | Split accumulators across threads; spills show as `.local` in PTX. |
| LSE merge | 12, 13 | `(out, lse)` pairs from disjoint key blocks combine exactly in any order. |
| Ring / striped attention | 13 | Rotate K/V, overlap transfer with compute; stripe tokens for causal balance. |
| Kernel fusion | 18 | One read + one write per pointwise chain; `torch.compile` shows the Triton. |
| Profile-first | 18 | Sync points hide real costs; `CUDA_LAUNCH_BLOCKING=1` reveals them. |
| Kogge–Stone vs Brent–Kung | 20/21 | Fewer steps vs fewer operations. |
| Decoupled look-back | 24 | Publish aggregates early; reaches memcpy speed (2N bytes). |

## Next

Continue with [Track 3 — Triton, Compilers & DSLs](./GPU-03-Triton-Compilers-DSLs.md).
