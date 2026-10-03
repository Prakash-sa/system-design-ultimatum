# Compilers, Profiling, and Code Tuning for HPC

Fast hardware does not rescue code that moves too much data, prevents vectorization, or spends its time synchronizing. This guide connects compiler transformations to the evidence you should collect before and after a change.

## The Performance Engineering Loop

1. **Define the workload**: fixed input, correctness tolerance, machine, placement, and thread/rank counts.
2. **Measure a baseline**: wall time, variability, CPU/GPU utilization, memory bandwidth, and I/O.
3. **Locate the limiting resource**: front end, execution ports, cache/DRAM, communication, storage, or imbalance.
4. **Change one thing**: algorithm, layout, compiler option, loop, communication pattern, or placement.
5. **Re-measure**: require an end-to-end improvement, not merely a faster micro-kernel.

> Optimization without a reproducible baseline is storytelling. Preserve inputs, commands, affinity, compiler versions, and counter definitions with every result.

## Compiler Optimization Pipeline

Compilers lower source code through an intermediate representation, analyze control/data flow, transform it, select instructions, allocate registers, and schedule instructions for a target microarchitecture.

### Core transformations

| Transformation | What it does | Main payoff | Common risk |
|---|---|---|---|
| Constant propagation/folding | replaces known values and precomputes expressions | removes work and exposes later optimizations | little benefit when values are runtime-only |
| Dead-code elimination | removes unreachable or unused computations | reduces instruction count | volatile/observable behavior constrains it |
| Function inlining | substitutes a callee body at the call site | removes call overhead; exposes more optimization | code-size and instruction-cache growth |
| Strength reduction | replaces expensive operations with cheaper equivalents | fewer cycles, simpler address arithmetic | floating-point transformations can change rounding |
| Loop-invariant code motion | moves constant work outside a loop | less repeated work | aliasing or side effects may block it |
| Loop unrolling | duplicates loop bodies | fewer branches; more ILP/vector opportunity | register pressure and code bloat |
| Loop fusion | combines loops over the same range | improves locality; reduces launch/loop overhead | larger live sets can increase register/cache pressure |
| Loop fission | splits a large loop | improves vectorization or cache behavior | adds passes over data |
| Loop interchange | swaps nesting order | creates stride-1 access | must preserve dependences |
| Loop tiling/blocking | operates on cache-sized subregions | increases reuse; reduces DRAM traffic | tile-size sensitivity and edge handling |

### Optimization levels

- `-O2` is a safe production baseline for C/C++ and Fortran.
- `-O3` enables more aggressive loop/vector transformations; verify both performance and numerics.
- `-march=native` targets the build host. Use an explicit architecture when binaries move between node types.
- Link-time optimization can inline and eliminate across translation units but increases build cost.
- Fast-math flags relax IEEE rules. Use only when the numerical contract allows reassociation, reciprocal approximations, NaN/Inf changes, and signed-zero differences.

## Dependencies Decide What Can Run in Parallel

For two operations on the same location:

- **RAW** (read after write) is a true data dependence.
- **WAR** (write after read) and **WAW** (write after write) are name dependences; register renaming can remove them inside a core.
- A **loop-carried dependence** connects iteration `i` to a later iteration and may prevent vectorization or parallelization.

Reductions are special: the compiler/runtime can give each lane or thread a private accumulator, then combine them. Floating-point reductions may produce slightly different rounding because addition is not associative.

## Auto-Vectorization

A vectorizer wants a countable loop, independent iterations, predictable control flow, and affine memory accesses.

```c
void saxpy(size_t n, float a,
           const float * restrict x,
           float * restrict y) {
    #pragma omp simd aligned(x, y: 64)
    for (size_t i = 0; i < n; ++i)
        y[i] = a * x[i] + y[i];
}
```

### Common blockers and fixes

| Blocker | Evidence | Typical fix |
|---|---|---|
| Possible pointer aliasing | report says unsafe dependent memory ops | `restrict`, clearer ownership, runtime alias check |
| Non-unit stride | gathers/scatters or scalar loop | interchange loops, transpose, change layout |
| Branch-heavy body | low vector utilization | split cases, use masks/selects, sort/group data |
| Function calls | loop remains scalar | inline; use vector math library or declare SIMD variant |
| Unknown trip count/alignment | remainder-heavy or unaligned path | alignment contract, peel/remainder loop, padding |
| Loop-carried dependence | vectorizer explicitly refuses | algorithmic restructuring; prefix/scan; accept serialization |

Use the compiler's optimization report: GCC `-fopt-info-vec`, Clang `-Rpass=loop-vectorize -Rpass-missed=loop-vectorize`, and vendor equivalents. Inspect assembly only after the report identifies an important loop.

## Intrinsics, SIMD, and Masks

Intrinsics expose ISA operations such as AVX2/AVX-512 when auto-vectorization is insufficient. They offer control but increase code volume and reduce portability. Prefer this order:

1. make the loop and layout compiler-friendly;
2. use portable SIMD directives/libraries;
3. use target-specific intrinsics for a measured hotspot;
4. keep a scalar/reference implementation for correctness and fallback.

Masked operations let vector lanes conditionally load, compute, or store without a scalar branch. They help with tails and moderately divergent logic, but inactive lanes still consume issue capacity.

## Data Layout and Alignment

### Array of structures vs structure of arrays

```text
AoS: [x0 y0 z0] [x1 y1 z1] ...
SoA: [x0 x1 ...] [y0 y1 ...] [z0 z1 ...]
```

SoA usually vectorizes and coalesces better when a kernel touches one field across many objects. AoS is convenient when every field of one object is consumed together. Array-of-structures-of-arrays (AoSoA) tiles records into vector-sized blocks and often balances both needs.

- Align hot arrays to the cache-line/vector boundary (commonly 64 bytes).
- Pad per-thread counters so independent writers do not share a cache line.
- Avoid power-of-two leading dimensions that create cache-set conflicts when evidence shows conflict misses.
- Do not copy merely for alignment unless the reused work repays the copy.

## Cache and Branch Tuning

### Cache optimization checklist

- traverse the innermost dimension with stride 1;
- tile working sets for the cache level that should retain reuse;
- fuse loops when it removes round trips to memory;
- fission loops when too many live arrays exceed cache/register capacity;
- prefetch only after hardware prefetching is shown to fail;
- replace linked structures with packed arrays when traversal dominates.

### Branch optimization

Predictable branches are cheap; unpredictable data-dependent branches can flush the pipeline. Options include partitioning inputs, table lookup, conditional moves, and masks. Branchless code is not automatically faster: extra operations and loads can cost more than a well-predicted branch.

## Register Allocation and Instruction Scheduling

The compiler maps many virtual values to a finite register file. Too many live values cause **spills** to the stack/local memory.

- Excessive unrolling, fusion, and large GPU thread-local arrays increase register pressure.
- Inlining may expose optimization but also enlarge live ranges.
- Software pipelining/interleaving creates independent operations to cover latency.
- On GPUs, registers per thread directly limit resident warps and therefore occupancy.

The correct goal is not minimum registers; it is enough independent work without spilling or destroying occupancy.

## Profiling Tools by Question

| Question | Linux/native tools | GPU/distributed tools |
|---|---|---|
| Where is wall time spent? | `time`, perf record/report, sampling profilers | Nsight Systems, rocprof, rank timelines |
| Which call paths dominate? | perf call graph, gprof, VTune, HPCToolkit | Nsight Systems/Compute, Score-P, TAU |
| Front end, cache, or execution bound? | perf stat, VTune top-down, PAPI | Nsight Compute roofline/counters |
| Is memory the bottleneck? | cache misses, bandwidth counters, NUMA stats | HBM throughput, coalescing, bank conflicts |
| Are ranks imbalanced? | per-rank timers, mpiP | Vampir, Paraver, Scalasca traces |
| Are allocations/leaks wrong? | sanitizers, Valgrind, heaptrack | Compute Sanitizer, ROCm sanitizers |

### Sampling vs tracing

- **Statistical sampling** interrupts periodically and estimates where time is spent. It has low overhead and is the first choice for broad profiling.
- **Instrumentation/tracing** records events and durations. It exposes causality and synchronization but can create huge files and perturb timing.
- Start with sampling/counters. Trace a narrowed interval, subset of ranks, or representative iteration.

## Hardware Performance Counters

Counters count events such as cycles, instructions, branches, cache misses, vector instructions, and memory-controller traffic. Interpret ratios, not isolated counts:

```text
IPC              = instructions / cycles
branch miss rate = branch_misses / branches
LLC miss rate    = LLC_misses / LLC_accesses
bandwidth        = bytes_transferred / time
```

Counter availability and names vary by CPU. Multiplexing too many events reduces accuracy. Always note whether counts are per core, process, socket, or system.

## Roofline-Guided Diagnosis

Arithmetic intensity is FLOPs per byte moved from the relevant memory level:

```text
attainable performance = min(peak FLOP/s, bandwidth × arithmetic intensity)
```

- Below the sloped bandwidth roof: reduce bytes, improve locality, coalesce, compress, or fuse.
- Below the flat compute roof: improve SIMD/FMA use, occupancy, instruction mix, or parallelism.
- Far below both: look for latency, dependencies, branches, imbalance, synchronization, or insufficient concurrency.

## Scalability Analysis

Break elapsed time into useful compute, communication, synchronization, I/O, runtime overhead, and imbalance. A faster kernel can make communication a larger fraction and reduce end-to-end scaling.

For every scaling result report:

- problem size and strong/weak definition;
- nodes, ranks, threads, accelerators, binding and placement;
- minimum/median/maximum rank time;
- communication and I/O time separately;
- repetitions and variability;
- achieved bandwidth/FLOPS relative to a relevant machine benchmark.

## Practical Tuning Order

1. Validate the algorithm and asymptotic work.
2. Remove unnecessary allocation, copying, conversion, logging, and I/O.
3. Fix data layout, locality, NUMA placement, and vectorization.
4. Tune threading and rank decomposition; eliminate imbalance and oversubscription.
5. Reduce message count, volume, and synchronizations; overlap when useful work exists.
6. Tune storage access and checkpoint behavior.
7. Only then tune low-level instructions, unroll factors, prefetch distances, and launch parameters.

## Interview / Exam Summary

- Explain what a transformation changes and which bottleneck it addresses.
- Alias analysis, dependencies, alignment, control flow, and layout determine vectorization.
- Unrolling/fusion are tradeoffs: less overhead/reuse versus code size and register pressure.
- Sampling finds hotspots; tracing explains timelines; counters identify the limiting resource.
- Roofline separates bandwidth ceilings from compute ceilings.
- Optimize end-to-end time with reproducible evidence, not a single attractive counter.

## Related Files

- [HPC-00-Learning-Roadmap.md](./HPC-00-Learning-Roadmap.md)
- [HPC-06-Computer-Architecture.md](./HPC-06-Computer-Architecture.md)
- [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md)
- [HPC-08-Parallel-Algorithms-Performance.md](./HPC-08-Parallel-Algorithms-Performance.md)
