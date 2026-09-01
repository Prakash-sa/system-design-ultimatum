# Computer Architecture for HPC

This file covers the single-node hardware foundations that HPC courses (NPTEL "High Performance Computing", computer architecture segments of parallel computing courses) spend most of their time on: how a core executes instructions, how the memory hierarchy behaves, why NUMA and cache coherence matter, and how nodes are wired together. Performance tuning is impossible without this layer.

## Why This Layer Matters

A cluster is only as good as what each core does per cycle. Most "parallel" performance problems are actually **serial memory-behavior problems**: cache misses, false sharing, NUMA misses, unvectorized loops. Fix the node first, then scale out.

## Inside a Core: Pipelining

A processor overlaps instruction execution in stages (classic 5-stage: fetch → decode → execute → memory → writeback). With `k` stages, ideal throughput approaches 1 instruction/cycle with latency unchanged.

### Pipeline hazards

| Hazard | Cause | Mitigation |
|---|---|---|
| **Structural** | two instructions need the same hardware unit | duplicate units, stall |
| **Data** | instruction needs a result not yet produced (RAW; also WAR/WAW) | forwarding/bypassing, stalls, register renaming |
| **Control** | branch outcome unknown when fetching next instruction | branch prediction, speculation |

- **RAW** (read after write) is a true dependence; **WAR/WAW** are name dependences removed by register renaming.
- A mispredicted branch flushes the pipeline — modern predictors are >95% accurate, but branchy inner loops still hurt.

## Instruction-Level Parallelism (ILP)

- **Superscalar**: issue multiple instructions per cycle (4–6 wide today).
- **Out-of-order execution**: hardware reorders independent instructions around stalls; a reorder buffer retires them in order.
- **Speculative execution**: execute past predicted branches; squash on mispredict.
- ILP is limited by dependences, branch behavior, and memory latency — which is why architects turned to **data-level parallelism (SIMD)** and **thread-level parallelism (multicore)**.

### Why frequency stopped scaling

Dennard scaling ended: shrinking transistors no longer lowers voltage proportionally, so power (~ C·V²·f) becomes the limit — the **power wall**. Result: more cores at modest clocks instead of faster single cores. All modern performance growth is parallelism.

## SIMD / Vector Units

One instruction operates on a whole vector register:

| ISA | Width | Doubles per op |
|---|---|---|
| SSE | 128-bit | 2 |
| AVX/AVX2 | 256-bit | 4 |
| AVX-512 | 512-bit | 8 |
| ARM NEON | 128-bit | 2 |
| ARM SVE/SVE2 | 128–2048-bit (scalable) | varies |

- **FMA** (fused multiply-add) does `a*b + c` in one instruction → counts as 2 FLOPs.
- Peak FLOPS depends on vectorization: scalar code on an AVX-512 machine leaves ~16× (8 lanes × 2 FMA) on the table.
- What blocks vectorization: loop-carried dependences, pointer aliasing, non-unit strides, branches in the loop body. See [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md) for how to help the compiler.

## Simultaneous Multithreading (SMT / Hyper-Threading)

2+ hardware threads share one core's execution units to hide stalls. For memory-bound HPC codes SMT often *hurts* (cache contention), so HPC clusters frequently disable it or schedule one rank/thread per physical core.

## The Memory Hierarchy

| Level | Size | Latency | Notes |
|---|---|---|---|
| Registers | ~KB | 0 cycles | compiler-managed |
| L1 cache | 32–64 KB/core | ~4 cycles | split I/D |
| L2 cache | 0.5–2 MB/core | ~12 cycles | per-core |
| L3 cache | 10s–100s MB | ~40 cycles | shared per socket |
| DRAM | 100s GB | ~100 ns | ~100–400 GB/s per socket |
| HBM (GPU/some CPUs) | 10s GB | similar latency, ~1–3 TB/s | bandwidth tier |
| NVMe / parallel FS | TB–PB | µs–ms | I/O tier |

CPUs compute far faster than DRAM can feed them (the **memory wall**). Caches only work because programs have **locality**:
- **Temporal locality**: recently used data is reused soon.
- **Spatial locality**: neighbors of used data are used soon (cache lines are 64 bytes — you always fetch 8 doubles).

## Cache Organization

- Data moves in **cache lines** (typically 64 B).
- **Mapping**: direct-mapped (1 place per line), N-way set-associative (N places), fully associative. Real caches: 4–16 way.
- **Replacement**: (pseudo-)LRU within a set.
- **Write policy**: write-back + write-allocate is typical (write-through is simpler but bandwidth-hungry).

### The 3 Cs of cache misses (+1)

| Miss type | Cause | Fix |
|---|---|---|
| **Compulsory** | first touch of a line | prefetching, larger lines |
| **Capacity** | working set > cache | blocking/tiling, smaller working sets |
| **Conflict** | too many lines map to one set | padding, changing leading dimensions (avoid power-of-2 strides) |
| **Coherence** | another core invalidated the line | avoid sharing, avoid false sharing |

## Cache-Friendly Programming (course staple)

Row-major C arrays: `a[i][j]` and `a[i][j+1]` are adjacent. Always make the **innermost loop stride-1**.

```c
/* BAD: column order, stride N, one cache miss per element */
for (j = 0; j < N; j++)
  for (i = 0; i < N; i++)
    sum += a[i][j];

/* GOOD: row order, stride 1, one miss per 8 doubles */
for (i = 0; i < N; i++)
  for (j = 0; j < N; j++)
    sum += a[i][j];
```

Key loop transformations:
- **Loop interchange**: reorder loops for stride-1 access.
- **Loop tiling/blocking**: process B×B blocks that fit in cache — the classic fix for matrix multiply, turning O(N³) memory traffic into O(N³/B).
- **Loop unrolling**: fewer branches, more ILP, enables vectorization.
- **Loop fusion**: merge loops over the same data to reuse cached values (fission does the reverse to shrink working sets).
- **Array of Structs → Struct of Arrays (AoS → SoA)**: if you only touch one field, SoA gives unit stride and vectorizes.
- **Prefetching**: hardware handles regular strides; software prefetch/streaming stores for irregular patterns.

### Blocked matrix multiply sketch

```c
for (ii = 0; ii < N; ii += B)
 for (jj = 0; jj < N; jj += B)
  for (kk = 0; kk < N; kk += B)
   for (i = ii; i < ii+B; i++)
    for (j = jj; j < jj+B; j++)
     for (k = kk; k < kk+B; k++)
      C[i][j] += A[i][k] * B[k][j];
```

Choose B so three B×B blocks fit in cache. In practice: call BLAS (`dgemm`) — it does this plus vectorization plus prefetching.

## Virtual Memory and the TLB

- Programs use virtual addresses; hardware translates via **page tables** (pages typically 4 KB).
- The **TLB** caches translations (~1500 entries). A 4 KB-page TLB covers only ~6 MB — large scientific arrays thrash it.
- **Huge pages** (2 MB / 1 GB) expand TLB reach; HPC systems often enable transparent huge pages or explicit hugetlbfs for big arrays.
- Page faults and first-touch page placement matter for NUMA (below).

## NUMA (Non-Uniform Memory Access)

Each socket has its own memory controller; a socket's cores reach local DRAM faster (~100 ns) than the other socket's (~150–200 ns, over the inter-socket link).

Rules that matter:
- **First-touch policy**: a page is placed on the NUMA node of the core that first *writes* it. Initialize arrays with the same thread layout that will compute on them (a serial init loop puts everything on socket 0 and halves bandwidth for socket 1's threads).
- **Bind threads and ranks** (`OMP_PROC_BIND`, `numactl`, Slurm `--cpu-bind`) so they don't migrate away from their memory.
- One MPI rank per socket (or per NUMA node) with threads inside is a common hybrid layout precisely because of NUMA.
- GPUs and NICs also hang off a specific socket — GPU/NIC locality is NUMA too.

Inspect with `numactl --hardware`, `lstopo`, `numastat`.

## Cache Coherence

With private caches, hardware must keep copies of a line consistent.

### MESI protocol (know the states)

| State | Meaning |
|---|---|
| **M**odified | only this cache has it; dirty |
| **E**xclusive | only this cache has it; clean |
| **S**hared | multiple caches may have it; clean |
| **I**nvalid | not usable |

A write requires exclusive ownership → other copies get invalidated → their next read misses (coherence miss). Extensions: MOESI, MESIF.

### Snooping vs directory

- **Snooping**: every cache watches a shared bus for others' transactions. Simple; doesn't scale past a handful of cores.
- **Directory-based**: a directory tracks which cores hold each line and sends targeted invalidations. Scales to many cores/sockets; used in all modern multi-socket systems.

### False sharing (classic exam + real-world bug)

Two threads write *different* variables that live on the *same* 64 B cache line → the line ping-pongs between cores in M state → huge slowdown with zero logical sharing.

```c
double partial[NTHREADS];          /* adjacent doubles share lines: BAD */

struct { double v; char pad[56]; } partial[NTHREADS];  /* pad to 64 B: GOOD */
```

Fixes: pad/align per-thread data to cache-line size, use thread-local accumulators, let OpenMP `reduction` handle it.

## Memory Consistency (brief but examinable)

Coherence orders accesses to *one* location; **consistency** defines ordering across *different* locations.
- **Sequential consistency**: all threads see one global interleaving — intuitive, expensive; real CPUs don't give it by default.
- **Relaxed models** (x86-TSO: store buffering; ARM/POWER weaker): loads/stores can reorder → lock-free code needs **fences/atomics** (`std::atomic`, `#pragma omp flush`).
- Practical rule: use locks, atomics, and the constructs OpenMP/MPI provide; don't rely on plain loads/stores for synchronization.

## The Roofline Model

Plots attainable FLOPS against **operational (arithmetic) intensity** I = FLOPs / bytes moved from memory:

```text
attainable FLOPS = min( peak FLOPS , I × memory bandwidth )
```

- Low I (STREAM triad ~0.08, SpMV ~0.1–0.25, stencils ~0.2–0.5): **memory-bound** — optimize data movement, not arithmetic.
- High I (dense matmul with blocking: grows with block size): **compute-bound** — vectorize, use FMA, use GPUs.
- The "ridge point" I* = peak/bandwidth tells you which side you're on (~5–10 FLOPs/byte on modern CPUs, similar on GPUs with HBM).

Measure achievable bandwidth with **STREAM**; this is the single most useful mental model for "why is my code slow."

## GPU Architecture in One Section

(Programming details in [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md).)

- A GPU is dozens–hundreds of **SMs** (streaming multiprocessors), each running thousands of lightweight threads.
- Threads execute in **warps of 32** in lockstep (SIMT). Branch divergence within a warp serializes both paths.
- Latency is *hidden by parallelism*, not caches: when a warp stalls on memory, the SM switches to another warp instantly. You need massive oversubscription (10,000s of threads).
- Memory hierarchy: registers → **shared memory** (per-SM, user-managed, ~100 KB) → L2 → HBM (1–3 TB/s).
- CPU↔GPU transfers cross PCIe (~32–64 GB/s) or NVLink (~450–900 GB/s) — often the real bottleneck.
- Design consequence: GPUs win when there is abundant regular data parallelism and high arithmetic intensity; they lose on branchy, latency-sensitive, or small workloads.

## Interconnection Networks

How nodes (and switches) are wired. Course-level metrics for a topology with p nodes:

| Metric | Meaning |
|---|---|
| **Degree** | links per node (hardware cost) |
| **Diameter** | worst-case hops (latency bound) |
| **Bisection bandwidth** | min bandwidth across any cut splitting the machine in half (all-to-all capacity) |
| **Cost** | total links/switches |

### Topologies

| Topology | Diameter | Bisection | Notes |
|---|---|---|---|
| Bus | 1 | 1 link | doesn't scale; contention |
| Ring | p/2 | 2 | cheap, used inside chips and NCCL algorithms |
| 2D mesh | 2(√p−1) | √p | matches stencil codes |
| 2D/3D torus | halved vs mesh | 2√p | wraparound links; Blue Gene, Fugaku (6D) |
| Hypercube | log p | p/2 | elegant; degree grows with log p; basis of many algorithms |
| Crossbar | 1 | p/2 | ideal but O(p²) cost; inside switches |
| **Fat tree / Clos** | 2·levels | full (if non-blocking) | the standard for InfiniBand clusters |
| **Dragonfly** | ~3 | high | groups of routers, all-to-all between groups; Cray Slingshot |

- **Fat tree** fixes the tree's root bottleneck by making upper links fatter; "full bisection" means any half can talk to the other half at full rate. Clusters often build 2:1 or 4:1 **oversubscribed** fat trees to save cost — fine for embarrassingly parallel, painful for all-to-all (FFT, training).
- **Routing**: deterministic (dimension-order in meshes) vs adaptive (avoid congestion). **Switching**: store-and-forward (latency ∝ hops × message size) vs cut-through/wormhole (latency ≈ hops + message size) — modern fabrics are cut-through.

### Simple communication cost model

```text
T(message) = α + β × n      (α = latency/startup, β = 1/bandwidth, n = bytes)
```

α ≈ 1–2 µs and 1/β ≈ 10–40 GB/s on modern fabrics. Small messages pay α; that's why batching messages and avoiding many tiny sends matters. This α–β model is used throughout [HPC-08-Parallel-Algorithms-Performance.md](./HPC-08-Parallel-Algorithms-Performance.md).

## Interview / Exam Summary

- Performance = parallelism now; frequency scaling is dead (power wall).
- Know the 3 hazards, RAW vs WAR/WAW, why branch prediction matters.
- Peak FLOPS formula and why vectorization is mandatory to approach it.
- 3 Cs of misses; stride-1 access; tiling for matmul; AoS vs SoA.
- First-touch + binding for NUMA; false sharing and its padding fix.
- MESI states; snooping vs directory; coherence ≠ consistency.
- Roofline: compute-bound vs memory-bound via arithmetic intensity.
- Fat tree vs torus vs dragonfly; bisection bandwidth; α + βn cost model.

## Related Files

- [HPC-01-Fundamentals.md](./HPC-01-Fundamentals.md)
- [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md)
- [HPC-08-Parallel-Algorithms-Performance.md](./HPC-08-Parallel-Algorithms-Performance.md)
- [HPC-03-Storage-Networking-Operations.md](./HPC-03-Storage-Networking-Operations.md)
