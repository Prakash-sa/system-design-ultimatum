# HPC Fundamentals

This is the entry point for the whole HPC note set. Start here, then go deeper with the focused files. Together these notes cover both the **platform/interview side** (Slurm, MPI, storage, cloud) and the **academic course side** (architecture, parallel programming, parallel algorithms, performance theory — the material in NPTEL HPC / parallel computing courses, CMU 15-418-style courses, and CUDA courses).

## The Full Map

| File | Covers |
|---|---|
| [HPC-01-Fundamentals.md](./HPC-01-Fundamentals.md) (this file) | definitions, taxonomies, workload shapes, scaling laws, glossary |
| [HPC-02-Slurm-MPI.md](./HPC-02-Slurm-MPI.md) | Slurm scheduling and MPI essentials |
| [HPC-03-Storage-Networking-Operations.md](./HPC-03-Storage-Networking-Operations.md) | storage tiers, fabrics, cluster operations |
| [HPC-04-Cloud-ParallelCluster.md](./HPC-04-Cloud-ParallelCluster.md) | cloud HPC and AWS ParallelCluster |
| [HPC-05-Interviews.md](./HPC-05-Interviews.md) | interview frameworks and practice prompts |
| [HPC-06-Computer-Architecture.md](./HPC-06-Computer-Architecture.md) | pipelines, ILP, SIMD, caches, NUMA, coherence, roofline, interconnect topologies |
| [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md) | Pthreads, OpenMP deep dive, MPI advanced, CUDA/GPU, hybrid, PGAS |
| [HPC-08-Parallel-Algorithms-Performance.md](./HPC-08-Parallel-Algorithms-Performance.md) | PRAM, work-span, performance laws, parallel algorithms, load balancing, benchmarks |
| [HPC.md](./HPC.md) | the interview-heavy master guide with Q&A, design patterns, and mock prompts |

Suggested reading order for course-style study: 01 → 06 → 07 → 08 → 02 → 03 → 04 → 05.

## What is HPC?

High Performance Computing (HPC) is the use of aggregated compute resources — many cores, many nodes, accelerators, fast interconnects, parallel storage — to solve problems that are too large, too slow, or too time-sensitive for a single machine.

Typical workloads:
- weather and climate simulation
- CFD (computational fluid dynamics)
- molecular dynamics, quantum chemistry
- genomics and bioinformatics pipelines
- Monte Carlo simulation (finance, physics)
- seismic imaging, reservoir simulation
- AI/ML training at scale
- cryptanalysis, large-scale optimization

## A Very Short History

| Era | Dominant design |
|---|---|
| 1970s–80s | vector supercomputers (Cray-1: one very fast pipelined vector CPU) |
| 1990s | massively parallel processors (MPPs), custom interconnects |
| 2000s | commodity clusters (Beowulf model): x86 nodes + Linux + MPI + Ethernet/InfiniBand |
| 2010s | multicore + GPU acceleration, petascale |
| 2020s | exascale (Frontier, Aurora, El Capitan), heterogeneous CPU+GPU nodes, cloud HPC |

The lesson of the history: performance stopped coming from faster single processors (power wall, end of Dennard scaling) and now comes almost entirely from **parallelism**.

## Units and Peak Performance

- **FLOPS** = floating-point operations per second.
- GigaFLOPS (10⁹), TeraFLOPS (10¹²), PetaFLOPS (10¹⁵), ExaFLOPS (10¹⁸).

Peak (theoretical) FLOPS of a CPU node:

```text
peak = sockets × cores/socket × clock (GHz) × vector width (elements) × FMA (2) × FMA units
```

Example: 2 sockets × 32 cores × 2.5 GHz × 8 doubles (AVX-512) × 2 (FMA) × 2 units ≈ 5.1 TFLOPS double precision.

Real applications typically reach a small fraction of peak — memory bandwidth, communication, and serial sections dominate. That gap is what most of HPC engineering is about. See the roofline model in [HPC-06-Computer-Architecture.md](./HPC-06-Computer-Architecture.md).

## The Core Goal

HPC optimizes for:
- **time-to-solution** (strong scaling: finish one job faster)
- **throughput** (many jobs per day)
- **capability** (solve problems that fit nowhere else)
- efficient use of compute, memory bandwidth, network, and storage

## HPC vs General Distributed Systems

| Dimension | HPC | General Distributed Systems |
|---|---|---|
| Goal | time-to-solution, throughput | availability, elasticity |
| Workload | batch, simulation, training | online serving, APIs |
| Communication | frequent, structured, latency-critical (MPI) | request/response, queues |
| Network | low-latency fabrics (InfiniBand, EFA), RDMA | standard Ethernet usually fine |
| Failure handling | checkpoint/restart | retries, replication, consensus |
| Scheduling | batch queues, gang scheduling | orchestration, autoscaling |
| State | large in-memory state per job | externalized state (DBs) |

## Flynn's Taxonomy

Classifies architectures by instruction and data streams:

| Class | Meaning | Examples |
|---|---|---|
| **SISD** | single instruction, single data | classic sequential CPU core |
| **SIMD** | single instruction, multiple data | vector units (AVX), GPUs (per warp) |
| **MISD** | multiple instruction, single data | rare; some fault-tolerant/systolic designs |
| **MIMD** | multiple instruction, multiple data | multicore CPUs, clusters |

Two useful refinements:
- **SPMD** (single program, multiple data): the dominant *programming* style — every MPI rank runs the same program on different data. MIMD hardware, SPMD software.
- **SIMT** (single instruction, multiple threads): NVIDIA's GPU execution model — SIMD executed by threads grouped in warps.

## Memory Architecture Classes

| Class | Description | Programming model |
|---|---|---|
| **Shared memory (UMA/SMP)** | all cores see one memory, uniform latency | threads: OpenMP, Pthreads |
| **Shared memory (NUMA)** | one address space, non-uniform latency by socket | threads + placement discipline |
| **Distributed memory** | each node has private memory | message passing: MPI |
| **Hybrid** | distributed nodes, shared memory + GPUs inside each | MPI + OpenMP + CUDA |
| **PGAS** | partitioned global address space (logical shared, physical distributed) | UPC, Coarray Fortran, Chapel |

Almost every real cluster today is hybrid: MPI across nodes, threads/GPUs within a node.

## Core Terms

- **Node**: one machine in the cluster
- **Core**: execution unit inside a CPU
- **Socket**: physical CPU package; a node commonly has 1–2
- **NUMA**: non-uniform memory access — memory latency depends on which socket owns the memory
- **Accelerator**: GPU or other offload device attached to a node
- **Rank**: one MPI process
- **Thread**: execution context inside a process (OpenMP/Pthreads)
- **Job**: unit submitted to the scheduler
- **Task**: what the scheduler launches (often one rank per task)
- **Partition/Queue**: policy-managed pool of resources
- **Wall time**: real elapsed time limit for a job
- **Interconnect/Fabric**: the network connecting nodes
- **Scratch**: fast temporary parallel storage
- **Checkpoint**: saved application state used to restart after failure

## Workload Shapes

### Embarrassingly parallel

Tasks are independent, no communication between them.

Examples: parameter sweeps, Monte Carlo, rendering, per-sample genomics.

Best fits: job arrays, cloud batch, spot capacity.

### Tightly coupled

Tasks communicate frequently (often every iteration).

Examples: CFD, climate models, molecular dynamics, iterative linear solvers.

Best fits: MPI, premium network fabric, homogeneous nodes, shared scratch.

### Hybrid

MPI across nodes plus threads or GPUs within nodes.

Examples: MPI + OpenMP weather codes, MPI + CUDA training/simulation.

### Pipeline / workflow

Stages with data dependencies between different programs.

Examples: genomics pipelines, data assimilation. Best fit: workflow engines (Nextflow, Snakemake) on top of the scheduler.

## Scaling Concepts

### Strong scaling

Fixed total problem size, more resources. Question: does runtime go down proportionally?

```text
speedup S(p) = T(1) / T(p)        efficiency E(p) = S(p) / p
```

Strong scaling always saturates: per-process work shrinks while communication and serial fractions do not.

### Weak scaling

Problem size grows with resources (fixed work per process). Question: does runtime stay roughly constant? This is how the biggest simulations justify the biggest machines.

### Amdahl's Law (strong-scaling limit)

If a fraction `f` of the program is serial:

```text
S(p) = 1 / (f + (1 - f)/p)        S(∞) = 1/f
```

Example: f = 5% serial → max speedup 20, no matter how many cores. Amdahl is why "just add nodes" fails.

### Gustafson's Law (weak-scaling view)

Scale the problem with the machine and the serial fraction shrinks relative to total work:

```text
S(p) = p - f × (p - 1)
```

Bigger systems let you solve bigger problems, not only fixed problems faster.

### Karp–Flatt metric (diagnosing real runs)

Given measured speedup S on p processors, the experimentally determined serial fraction:

```text
e = (1/S - 1/p) / (1 - 1/p)
```

If `e` grows with p, the bottleneck is parallel overhead (communication/imbalance), not inherent serial code. Great tool for "why did my job stop scaling" questions.

### Isoefficiency (scalability of algorithms)

How fast must the problem size grow, as p grows, to keep efficiency constant? Slower required growth = more scalable algorithm. Details and examples in [HPC-08-Parallel-Algorithms-Performance.md](./HPC-08-Parallel-Algorithms-Performance.md).

## Sources of Parallel Overhead

Every gap between ideal and real speedup comes from:
1. **serial sections** (Amdahl)
2. **communication** (latency + bandwidth costs)
3. **synchronization** (barriers, waiting on the slowest rank)
4. **load imbalance** (uneven work per process)
5. **redundant work** (recomputation, halo overlap)
6. **contention** (memory bandwidth, network, filesystem)

## Latency Numbers Worth Memorizing

| Operation | Approximate cost |
|---|---|
| L1 cache hit | ~1 ns |
| L2 hit | ~4 ns |
| L3 hit | ~10–30 ns |
| Local DRAM | ~80–100 ns |
| Remote-socket DRAM (NUMA) | ~130–200 ns |
| InfiniBand/EFA message latency | ~1–5 µs |
| TCP/Ethernet round trip (same DC) | ~50–500 µs |
| NVMe read | ~10–100 µs |
| Parallel FS small-file metadata op | ~ms |

The hierarchy spans ~6 orders of magnitude. Locality is the whole game.

## The 5-Layer HPC Mental Model

1. **workload shape** — independent, tightly coupled, GPU-heavy, or hybrid
2. **execution model** — job arrays, MPI, OpenMP, CUDA, hybrid
3. **scheduler and policy** — partitions, fairshare, QoS, backfill
4. **infrastructure** — compute, fabric, storage tiers
5. **operations** — monitoring, reproducibility, cost, multi-tenancy

## Quick Interview Frame

When asked any HPC design question:

1. classify the workload
2. decide if it is independent, tightly coupled, GPU-heavy, or hybrid
3. map that to scheduler, storage, and network
4. explain reliability and cost tradeoffs

## Where to Go Next

- Hardware and memory behavior → [HPC-06-Computer-Architecture.md](./HPC-06-Computer-Architecture.md)
- Writing parallel code → [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md)
- Algorithms and performance theory → [HPC-08-Parallel-Algorithms-Performance.md](./HPC-08-Parallel-Algorithms-Performance.md)
- Running jobs on clusters → [HPC-02-Slurm-MPI.md](./HPC-02-Slurm-MPI.md)
- Infrastructure → [HPC-03-Storage-Networking-Operations.md](./HPC-03-Storage-Networking-Operations.md), [HPC-04-Cloud-ParallelCluster.md](./HPC-04-Cloud-ParallelCluster.md)
- Interview prep → [HPC-05-Interviews.md](./HPC-05-Interviews.md), [HPC.md](./HPC.md)
