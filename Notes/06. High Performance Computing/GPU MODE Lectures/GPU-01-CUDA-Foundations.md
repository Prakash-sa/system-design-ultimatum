# GPU MODE Track 1 — CUDA Foundations

The mental model every later GPU MODE lecture assumes: how a kernel maps onto a grid of threads, how the SM schedules warps, why memory traffic usually beats FLOPs as the bottleneck, and how to prove where time goes with `torch.profiler`, Nsight Systems and Nsight Compute.

## Contents

- [Lecture 1 — Profiling and Integrating CUDA Kernels in PyTorch](#lecture-1--profiling-and-integrating-cuda-kernels-in-pytorch)
- [Lecture 2 — PMPP Ch. 1-3 Recap](#lecture-2--pmpp-ch-1-3-recap)
- [Lecture 3 — Getting Started With CUDA](#lecture-3--getting-started-with-cuda)
- [Lecture 4 — Compute and Memory Architecture](#lecture-4--compute-and-memory-architecture)
- [Lecture 5 — CUDA for Python Programmers: Tiled Matmul](#lecture-5--cuda-for-python-programmers-tiled-matmul)
- [Lecture 8 — CUDA Performance Checklist](#lecture-8--cuda-performance-checklist)
- [Lecture 16 — Hands-On Profiling](#lecture-16--hands-on-profiling)
- [Lecture 41 — CUDA Docs for Humans](#lecture-41--cuda-docs-for-humans)
- [Track summary](#track-summary)

---

## Lecture 1 — Profiling and Integrating CUDA Kernels in PyTorch

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L001-Profiling-CUDA-in-PyTorch.pdf) · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_001)

- **CUDA is asynchronous.** `time.time()` measures launch cost, not kernel cost. Time with `torch.cuda.Event` pairs plus `torch.cuda.synchronize()`, after warmup (the first call pays for JIT, allocator growth, cuBLAS/cuDNN handles).
- **The PyTorch profiler shows the dispatch chain.** `torch.square` lowers to `aten::pow` and a `vectorized_elementwise_kernel<4, …>`; `a * a`, `a ** 2` and `torch.square` can hit different ATen paths, so profile instead of guessing.
- **Pageable vs pinned memory.** Pageable host memory is staged through a pinned buffer (`Memcpy HtoD (Pageable -> Device)`); `pin_memory()` enables true async DMA.
- **`load_inline`** takes C++/CUDA source strings, generates the pybind11 glue, builds with ninja, and imports the result.
- **Triton is block-level; `torch.compile` generates Triton.** Triton coarsened `square` to 8 elements per thread unasked. `TORCH_LOGS="output_code"` prints the generated kernel, a good starting point.
- **`ncu` gives actionable hints.** A grid of 1.33 waves causes a **tail effect** (up to 50% of runtime): pad the grid. Long-scoreboard stalls point at coalescing or shared memory.
- **Bandwidth is the metric for elementwise kernels:** `GB/s = 2 * numel * element_size / time`, compared against peak DRAM bandwidth, not FLOP/s.

```python
start, end = torch.cuda.Event(enable_timing=True), torch.cuda.Event(enable_timing=True)
for _ in range(5): fn(x)          # warmup
start.record(); fn(x); end.record()
torch.cuda.synchronize(); ms = start.elapsed_time(end)
```

---

## Lecture 2 — PMPP Ch. 1-3 Recap

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L002-PMPP-Ch1-3-Recap.pdf) · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_002)

- **Why GPUs:** CPU clock scaling stalled around 2003 (power wall). GPUs optimize for throughput of a massive number of threads; sequential code belongs on the CPU.
- **Amdahl's law:** `speedup < 1 / (1 - p)`. At p = 90% the ceiling is 10×; 100× needs p > 99%.
- **Host/device model:** `cudaMalloc` → `cudaMemcpy` H2D → launch → D2H → `cudaFree`. In real code keep data resident on the GPU and queue many kernels asynchronously.
- **SPMD hierarchy:** a launch is a grid of blocks of threads (max 1024 threads per block), indexed via `blockIdx`, `threadIdx`, `blockDim`, `gridDim`.
- **Replace the loop with a grid:** one thread per output element, launch `ceil(n / threads)` blocks, and always bounds-check `if (i < n)`.
- **Qualifiers and compilation:** `__global__` (kernel), `__device__`, `__host__ __device__`. `nvcc` emits **PTX** (virtual ISA); the driver JIT-translates it to **SASS** (real machine code).
- **Memory is flat:** row-major index = `row * width + col`; strided/permuted tensors may not be contiguous.
- **Check errors:** kernel launches return nothing, so call `cudaGetLastError()` after the launch (or `C10_CUDA_KERNEL_LAUNCH_CHECK()` in extensions).

```cuda
__global__ void vecAddKernel(float* A, float* B, float* C, int n) {
  int i = threadIdx.x + blockDim.x * blockIdx.x;
  if (i < n) C[i] = A[i] + B[i];
}
vecAddKernel<<<cdiv(n, 256), 256>>>(A_d, B_d, C_d, n);
```

---

## Lecture 3 — Getting Started With CUDA

**Slides:** video only · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_003)

- **Write the kernel in Python first:** loop → `f(i, ...)` kernel → block kernel `f(blockIdx, threadIdx, blockDim, ...)` → CUDA C. Indexing bugs are debuggable with prints.
- **A kernel cannot return anything;** it only mutates the buffers it is given.
- **Global index:** `i = blockIdx.x * blockDim.x + threadIdx.x`; in 2D, `r` from `.y`, `c` from `.x`, guarded by bounds checks.
- **Planar (CHW) layout** makes channel access trivial: grey = `0.2989*x[i] + 0.5870*x[i+n] + 0.1140*x[i+2n]`, `n = h*w`.
- **Hardware:** a block runs entirely on one SM. RTX 3090: 82 SMs, each with 128 CUDA cores, a 256 KB register file, 128 KB combined L1/shared.
- **Launch limits:** up to 2³¹−1 blocks in `x`, 65 535 in `y`/`z`; ≤1024 threads per block; use multiples of 32.
- **Debugging:** `CHECK_CUDA`/`CHECK_CONTIGUOUS` input checks; `CUDA_LAUNCH_BLOCKING=1` makes errors surface at the launch that caused them.
- **Naive matmul** (one thread per output) re-reads every input from global memory `k` times and loses badly to cuBLAS: the setup for tiling.

---

## Lecture 4 — Compute and Memory Architecture

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L004-Compute-and-Memory-Architecture.pdf) · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_004)

- **An SM is roughly four CPU cores.** RTX 3090: 4 partitions per SM, each issuing one warp instruction per cycle; 128 FP32 units but only 2 FP64 units per SM; 128 KB L1/shared (shared up to 100 KB).
- **Block → SM placement is out of your control** (up to 1536 resident threads per SM on this part).
- **Divergence:** pre-Volta, masked with automatic reconvergence; Volta+ has per-thread PCs and no automatic reconvergence (`__syncwarp()`). A warp is done only when every path is done.
- **Occupancy is resource balancing** across threads, registers, shared memory and block count. For 16×16 tiled matmul, threads bind first (1536/256 = 6 blocks), so larger tiles are affordable.
- **Speed of light first:** rgb2gray on 2048² ≈ 18 µs memory, ~2 µs compute, ~3 µs launch; measured ~27 µs (~74% of theoretical).
- **The `f` suffix trap:** `0.2989*in[i]` is a double multiply; with 2 FP64 vs 128 FP32 units it can dominate runtime.
- **Fusion:** eager 8-op GELU 435 µs vs `F.gelu` 61.6 µs vs fused CUDA 55.9 µs on 1024×1024. One read, one write.
- **Roofline and tiling:** arithmetic intensity decides the bound. Tiling cuts global reads by `TILE`; `__syncthreads()` is needed both after loading and after computing each tile.

---

## Lecture 5 — CUDA for Python Programmers: Tiled Matmul

**Slides:** video only · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_005)

- **Tiling in phases:** for `ph = 0 .. ceil(k/tw)`, fill both shared tiles (zero-padded), then accumulate `tw`-long partial dot products.
- **The barrier is the loop separation.** The Python emulation with `threading.Barrier` needs two `wait()` calls per phase, matching the two `__syncthreads()`.
- **Dynamic vs static shared memory:** `extern __shared__ float ms[]` sized by the third `<<<>>>` argument; `__shared__ float ms[tw][tw]` needs a compile-time size.
- **Compile-time tile width matters most.** 5120×256 @ 256×5120: naive 6 ms, dynamic-shared runtime `tw` 6.64 ms, static `constexpr tw=16` 4.34 ms (unrolled loop, folded index math).
- **Templating recovers flexibility:** `template<int tw>` plus a runtime `switch` over 8/16/32 gives 4.35 ms.
- **Numba** (`@cuda.jit`, `cuda.shared.array`) is faster to iterate on (16.2 ms here) and has a CUDA simulator (`NUMBA_ENABLE_CUDASIM=1`).
- **Launch overhead floor** was ~50 µs for the wrapper; low-µs kernels are dominated by overhead.

---

## Lecture 8 — CUDA Performance Checklist

**Slides:** [external](https://docs.google.com/presentation/d/1cvVpf3ChFFiY4Kf25S4e4sPY6Y5uRUO-X-A4nJ7IhFE/edit?usp=sharing) · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_008)

- **First decide which bound you have.** Most deep-learning pointwise ops are memory-bound: measure achieved vs peak bandwidth.
- **Coalescing:** consecutive lanes → consecutive addresses. `in[(2*index) % n]` touches twice as many 32-byte sectors per warp as `in[index]`.
- **Occupancy:** `cudaOccupancyMaxPotentialBlockSize` suggests a block size; high occupancy helps latency-bound kernels but is not a goal in itself.
- **Divergence:** branchless arithmetic runs both sides for every lane, and the compiler often predicates short branches anyway, so measure before rewriting.
- **Tiling:** stage reused data in shared memory (Lectures 4–5).
- **Privatization:** per-block shared-memory copies of a contended output (e.g. histogram), then one global `atomicAdd` per bin per block.
- **Coarsening:** more work per thread cuts index math and scheduling overhead; keep it coalesced (grid-stride loop).
- **Rewrite the algorithm** when the algorithm itself is the bound (Lecture 9 onward).

---

## Lecture 16 — Hands-On Profiling

**Slides:** video only

- **Profile top-down:** timeline first (when is the GPU idle?), then individual kernels only if the GPU is the bottleneck.
- **`torch.profiler`:** record CPU + CUDA, use `schedule(wait, warmup, active, repeat)` and `prof.step()`; sort `key_averages()` by `self_cuda_time_total`; export Chrome traces for Perfetto.
- **Annotate** with `record_function("...")` or NVTX ranges so the trace maps to model structure.
- **Read gaps, not just bars:** tiny kernels with whitespace = launch-bound (fuse, `torch.compile`, CUDA Graphs); `.item()`/`.cpu()` force syncs; pageable H2D copies serialize with compute.
- **`nsys`** gives a lower-overhead system-level timeline (multi-process, multi-GPU); **`ncu`** replays one kernel for hardware counters, so target it with `-k`, `--launch-skip`, `--launch-count`.
- **Close the loop:** hypothesis → change one thing → re-profile → compare against the speed-of-light bound.

---

## Lecture 41 — CUDA Docs for Humans

**Slides:** [external](https://docs.google.com/presentation/d/15lTG6aqf72Hyk5_lqH7iSrc8aP1ElEYxCxch-tD37PE/edit#slide=id.g326210b960f_0_42)

- **The problem:** CUDA knowledge is scattered across many docs, and words like "CUDA" and "core" mean different things in different layers. The talk accompanies Modal's *GPU Glossary*.
- **Organize by layer:** device hardware (SM, warp scheduler, CUDA/Tensor Cores, register file, L1/shared, L2, HBM), device software (thread, warp, block, grid, cluster, PTX, SASS, compute capability), host software (runtime vs driver API, `nvcc`, NVML/`nvidia-smi`, cuBLAS/cuDNN, Nsight, CUPTI).
- **Hardware and software names pair up:** block ↔ SM, warp ↔ warp scheduler/sub-partition, shared memory ↔ L1 SRAM, global memory ↔ HBM.
- **A "CUDA core" is not a CPU core;** it is an FP32/INT32 ALU lane. The CPU-core analogue is closer to an SM sub-partition.
- **Compute capability** versions the feature set and SASS, not performance. PTX targets `compute_XX` (forward-compatible); SASS targets `sm_XX`.
- **Runtime API** (`cuda*`, `<<<>>>`) is the convenient layer; the **driver API** (`cu*`) is what JIT systems like Triton and `load_inline` sit on.

---

## Track summary

| Concept | Lecture | Takeaway |
|---|---|---|
| Async timing | 1 | CUDA events + `synchronize()` after warmup, never wall-clock. |
| Indexing | 2, 3 | `i = blockIdx.x*blockDim.x + threadIdx.x`, `cdiv(n, T)` blocks, always bounds-check. |
| PTX vs SASS | 2, 41 | PTX is the portable virtual ISA; SASS is what runs. |
| SM and warps | 4, 41 | 1 SM ≈ 4 schedulers; block → one SM, placement uncontrolled. |
| Occupancy | 4, 8 | Capped by threads, registers, shared memory, block count. |
| Speed of light | 4, 8 | Compute the memory/compute bound before optimizing. |
| FP64 trap | 4 | A missing `f` suffix makes FP32 math slow FP64. |
| Fusion | 1, 4 | One load, one store per pointwise chain (GELU 435 → ~56 µs). |
| Coalescing | 3, 8 | Consecutive lanes → consecutive addresses. |
| Tiling | 4, 5, 8 | Reuse each tile `TILE` times; barrier after load and after compute. |
| Compile-time constants | 5 | Templated tile width enables unrolling (6.64 → 4.35 ms). |
| Privatization / coarsening | 8 | Shared-memory partials, one global merge; more work per thread. |
| Profiling | 1, 16 | `torch.profiler`/`nsys` for timelines, `ncu` for one kernel's why. |

## Next

Continue with [Track 2 — Parallel Algorithms & Fused Kernels](./GPU-02-Parallel-Algorithms.md).
