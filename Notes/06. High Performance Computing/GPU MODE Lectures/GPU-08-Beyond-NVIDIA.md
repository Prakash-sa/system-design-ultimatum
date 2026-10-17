# GPU MODE Track 8 — Beyond NVIDIA

This track covers AMD (ROCm, Composable Kernel), Intel (SYCL/oneAPI), portable WebGPU (gpu.cpp), and Apple Silicon (Metal). The key lesson: **the execution model is the same everywhere** — a grid of groups of SIMD-lockstep lanes, a small on-chip scratchpad, and large global memory — so CUDA optimizations transfer once you learn the name mapping.

## Contents

- [Terminology Rosetta stone](#terminology-rosetta-stone)
- [Lecture 25 — AMD Composable Kernel](#lecture-25--amd-composable-kernel)
- [Lecture 26 — SYCL and Intel GPUs](#lecture-26--sycl-and-intel-gpus)
- [Lecture 27 — gpu.cpp and WebGPU](#lecture-27--gpucpp-and-webgpu)
- [Lecture 31 — Beginner's Guide to Metal Kernels](#lecture-31--beginners-guide-to-metal-kernels)
- [Track summary](#track-summary)
- [Next](#next)

## Terminology Rosetta stone

| Concept | CUDA (NVIDIA) | HIP / ROCm (AMD) | SYCL (Intel & others) | Metal (Apple) | WebGPU / WGSL |
|---|---|---|---|---|---|
| Single lane | thread | thread (work-item) | work-item | thread | invocation |
| Lockstep SIMD unit | warp (32) | wavefront (64 on CDNA / Instinct; 32 or 64 on RDNA) | sub-group (8/16/32 on Intel, chosen per kernel) | SIMD-group (32) | subgroup (size implementation-defined; `subgroups` feature) |
| Cooperating group | thread block (CTA) | block / workgroup | work-group | threadgroup | workgroup |
| Whole launch | grid | grid | `nd_range` (global range) | grid | dispatch (workgroup count) |
| On-chip scratchpad | shared memory (`__shared__`) | LDS (Local Data Share), still spelled `__shared__` | local memory (`local_accessor`; SLM on Intel) | threadgroup memory (`threadgroup`) | workgroup memory (`var<workgroup>`) |
| Per-lane fast storage | registers | VGPRs (plus SGPRs for wave-uniform values) | private memory / GRF | registers (thread address space) | `var<private>` / function vars |
| Device memory | global (`cudaMalloc`) | global (`hipMalloc`) | global (USM `malloc_device` / buffers) | `device` buffers (`MTLBuffer`) | `var<storage>` buffers |
| Read-only uniform data | `__constant__` | `__constant__` | constant / kernel args | `constant` address space | `var<uniform>` |
| Group barrier | `__syncthreads()` | `__syncthreads()` | `group_barrier(it.get_group())` | `threadgroup_barrier(mem_flags::mem_threadgroup)` | `workgroupBarrier()` |
| Local index | `threadIdx` | `threadIdx` | `it.get_local_id()` | `[[thread_position_in_threadgroup]]` | `@builtin(local_invocation_id)` |
| Global index | `blockIdx*blockDim+threadIdx` | same | `it.get_global_id()` | `[[thread_position_in_grid]]` | `@builtin(global_invocation_id)` |
| Lane shuffle | `__shfl_sync` | `__shfl` / DPP | `select_from_group(sg, …)` | `simd_shuffle` | `subgroupShuffle` |
| Matrix unit | Tensor Cores (`mma`, `wgmma`) | Matrix Cores (MFMA / WMMA) | XMX (`joint_matrix`) | `simdgroup_matrix` | none in core spec |
| Compute unit | SM | CU (WGP on RDNA) | Xe-core (vector engines) | GPU core | n/a (abstracted) |
| Launch | `kernel<<<grid, block>>>` | `<<<>>>` / `hipLaunchKernelGGL` | `q.parallel_for(nd_range, …)` | `dispatchThreads` / `dispatchThreadgroups` | `dispatchWorkgroups(x,y,z)` |
| Vendor BLAS / DNN | cuBLAS / cuDNN | rocBLAS, hipBLASLt / MIOpen, CK | oneMKL / oneDNN | MPS / MPSGraph | none (bring your own) |

- **Wave width matters:** a reduction hard-coded for 32 lanes is wrong or wasteful on 64-wide CDNA. Query it (`warpSize`, `sg.get_max_local_range()`, `threads_per_simdgroup`).
- **Scratchpad sizes differ** (e.g. LDS is 64 KB per CU on many AMD parts), so H100-tuned tiles are rarely optimal elsewhere.
- **HIP is near source-compatible with CUDA** (`hipify` is mostly renaming); SYCL is single-source C++; Metal and WGSL are separate shading languages.

## Lecture 25 — AMD Composable Kernel

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L025-AMD-Composable-Kernel.pdf)

- **Why utilization is hard:** complex memory hierarchy, several compute-unit kinds (VALU, DPP cross-lane ops, matrix cores), fast hardware iteration, and increasingly custom fused workloads.
- **CK philosophy:** a C++-templated paradigm for *Performance, Productivity, Portability* — express every optimization, abstract the hardware, compose through hierarchical APIs.
- **Coordinate transformation primitives:** tensor views composed with transforms (`pad`, `merge`, `xor` for bank-conflict swizzle, `passthrough`, `freeze`). Same idea as CuTe layouts: index math becomes composable algebra.
- **Implicit-GEMM convolution:** im2col is a transformation graph over input coordinates; the unfolded matrix is never materialized.
- **Tile programming:** users work with tiles — `static_distributed_tensor` (a tile spread across threads' registers), `tile_window` (a movable view onto global/LDS), and `load_tile` / `store_tile` / `warp_gemm`.
- **Kernel = Problem + Pipeline + Policy + Epilogue:** the pipeline composes data movement and compute; the policy injects optimizations (layouts, components). Users can reuse vendor pipelines with custom policies.
- **ROCm FlashAttention:** standard FA2 decomposition in CK-tile — Q in registers, Kᵀ through LDS, online softmax, `O += PV`, HBM traffic only at tile load and final store.

## Lecture 26 — SYCL and Intel GPUs

**Slides:** [external](https://docs.google.com/presentation/d/1SW4XKomAJhhJSH5-jpZI9Qlwp7TEunbV/edit?usp=sharing&ouid=106222972308395582904&rtpof=true&sd=true)

- **SYCL** is a Khronos standard for *single-source* heterogeneous C++17. Intel's implementation is **DPC++** (`icpx -fsycl`); AdaptiveCpp is another.
- **Execution model:** a `queue` bound to a device; kernels are lambdas passed to `parallel_for` over a `range` or an `nd_range` (needed for local memory, barriers, and group collectives).
- **Two memory models:** *buffers + accessors* (runtime builds a dependency DAG and moves data) or **USM** (`malloc_device/host/shared`, CUDA-like pointers, manual dependencies).
- **Sub-groups are first-class:** shuffles, broadcasts, reductions; size (8/16/32 on Intel) can be fixed per kernel with `[[sycl::reqd_sub_group_size(16)]]`.
- **Intel hardware:** Xe-cores with vector engines and **XMX** matrix engines; SLM = shared memory; large GRF; MMA via `joint_matrix` or oneDNN/oneMKL.
- **Portability:** SYCLomatic migrates CUDA to SYCL; DPC++ targets Intel (Level Zero/OpenCL) and NVIDIA/AMD via plugins. PyTorch exposes Intel GPUs as the `xpu` device.

## Lecture 27 — gpu.cpp and WebGPU

**Slides:** [external](https://gpucpp-presentation.answer.ai/)

- **WebGPU** is the W3C successor to WebGL, designed over Vulkan, Metal, and D3D12, with native implementations (Dawn, wgpu) usable outside browsers. Compute shaders are written in **WGSL**.
- **gpu.cpp:** a small C++ library over Dawn for portable, low-boilerplate compute on NVIDIA, AMD, Intel, and Apple GPUs with no CUDA toolkit. Hundreds of lines of raw WebGPU setup collapse into a few calls.
- **API shape:** `Context` → `Tensor`s from host data → `Kernel` from WGSL + workgroup size + bindings + workgroup count → dispatch, wait, `toCPU`.
- **Mapping:** `@workgroup_size(256)` = block size, `dispatchWorkgroups(n)` = grid, `var<workgroup>` = shared memory, `workgroupBarrier()` = `__syncthreads()`. Dispatch counts are in workgroups, so kernels need bounds checks as in CUDA.
- **Portability tax:** no matrix units in the core spec, optional subgroups, f16 behind a flag, conservative limits. Suits write-once kernels (GELU, softmax, small matmuls) and on-device/browser inference more than peak GEMM.

## Lecture 31 — Beginner's Guide to Metal Kernels

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L031-Metal-Kernels.pdf) · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_031)

- **Motivation:** the presenter's laptop has ~110 GFLOP of CPU vs ~7 TFLOP of GPU, but not CUDA. PyTorch's MPS backend doesn't cover every op, so you write Metal kernels. "If you can write CUDA, you can do Metal."
- **Terminology:** MSL (C++14-based shaders); `MTLBuffer` shareable with the CPU on unified memory (`MTLResourceStorageModeShared`, no copy); command buffer; MPS (cuBLAS/cuDNN analog); MPSGraph (fusing graph compiler, PyTorch's default path).
- **Host flow:** device → `newLibraryWithSource` → `MTLFunction` → pipeline state → command buffer → compute encoder → `setBuffer`/`setBytes` → `dispatchThreads` → `endEncoding` → `commit` → `waitUntilCompleted`.
- **Arguments bind by index:** MSL `[[buffer(n)]]` matches `setBuffer:… atIndex:n`; thread index comes from attributes like `[[thread_position_in_grid]]`.
- **Profiling:** Xcode GPU capture (`MTL_CAPTURE_ENABLED`, `.gputrace`); no command-line profiler, so time wall-clock with `torch.mps.synchronize()`.
- **GEMV ladder:** naive (one thread per output) → `float4` loads + `dot` → `float4x4` per thread (4 outputs, reuses the A vector) → SIMD-group-coordinated memory access (MLX `gemv.metal` is the reference).
- **Benchmark gotcha:** the lecture code's GFLOP formula counts `M·N·K`, half the conventional `2·M·N·K`.

```metal
kernel void gemm(constant float *A [[buffer(0)]], constant float *B [[buffer(1)]],
                 device float *C [[buffer(2)]], constant uint3 &sizes [[buffer(3)]],
                 uint2 tid [[thread_position_in_grid]]) {
  float rc = 0;
  for (uint k = 0; k < sizes.y; k++) rc += A[tid.y*sizes.y + k] * B[tid.x*sizes.y + k];
  C[tid.y * sizes.z + tid.x] = rc;
}
```

## Track summary

| Concept | Lecture | Takeaway |
|---|---|---|
| Universal execution model | all | Grid → group → SIMD lanes, with scratchpad, registers, global memory; only names change. |
| Wave/sub-group width | 25, 26, 31 | 32 is not universal (CDNA 64, Intel 8/16/32, Apple 32); query it, never hard-code. |
| Coordinate transforms, tile programming | 25 | Padding, im2col, swizzles as composable index math; vendors tune policies, users customize pipelines. |
| Single-source SYCL | 26 | `queue` + `nd_range` + sub-groups; USM gives CUDA-like pointers; SYCLomatic ports CUDA. |
| WebGPU / gpu.cpp | 27 | Portable compute on any GPU via Dawn + WGSL; pays a portability tax. |
| Metal | 31 | Library → pipeline → command buffer → encoder → dispatch; vectorize, then coordinate SIMD-groups. |
| Honest benchmarking | 31 | Sync before stopping the clock and count 2 FLOPs per FMA. |

## Next

Back to the plan: [GPU MODE Study Plan](./GPU-00-Study-Plan.md).
