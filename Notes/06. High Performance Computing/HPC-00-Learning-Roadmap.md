# High Performance Computing Learning Roadmap

Use this as the coverage map for the HPC notes. Start with architecture and parallel programming, then move through performance engineering, numerical methods, production infrastructure, and advanced hardware. Every roadmap topic is mapped to a focused guide below.

> Recommended order: fundamentals → architecture → parallel models → compilers and profiling → algorithms and numerical methods → storage and operations → scientific workloads → emerging systems. Learn each topic as a three-part loop: mental model, bottleneck, measurement.

## 01. Computer Architecture

### Processor design

- Pipelining, superscalar issue, out-of-order execution, branch prediction
- Vector processing, simultaneous multithreading, and hardware prefetching

### Memory and data movement

- Cache levels, coherence, DRAM organization, NUMA, HBM
- Memory bandwidth limits and latency-hiding techniques

### Storage and interconnects

- SSDs, parallel and distributed filesystems, striping, metadata, I/O bottlenecks
- Network topology, InfiniBand/RDMA, switch fabrics, routing, latency and bandwidth

[Study architecture →](./HPC-06-Computer-Architecture.md)

## 02. Parallel Programming

### Shared and distributed memory

- Threads, mutexes, semaphores, atomics, races, deadlocks, lock-free structures
- MPI point-to-point, collectives, topologies, non-blocking and one-sided communication

### Hybrid and task models

- MPI + threads/GPUs, node-level parallelism, hierarchical algorithms
- Task graphs, dependencies, work stealing, granularity, asynchronous runtimes

### Scaling practice

- Load balancing, resource placement, cluster scaling, communication hiding

[Study parallel programming →](./HPC-07-Parallel-Programming.md)

## 03. Compilers and Optimization

### Compiler transformations

- Loop unrolling, fusion, tiling, dead-code elimination, inlining
- Constant propagation, strength reduction, instruction scheduling

### Vectorization and code tuning

- Auto-vectorization, intrinsics, SIMD, masked operations, alignment
- Loop restructuring, data-layout transformation, aliasing, register pressure

### Measurement

- Hardware counters, wall-clock profiling, memory analysis, call graphs
- Tracing, statistical sampling, bottleneck identification, scalability analysis

[Study compilers and profiling →](./HPC-09-Compilers-Profiling-Tuning.md)

## 04. GPU Computing

### Architecture and programming

- Streaming multiprocessors, warps, coalescing, shared-memory banks
- Register pressure, divergence, tensor cores, kernel hierarchy
- CUDA, HIP, SYCL, OpenCL, memory management, streams, error handling

### Optimization and accelerators

- Occupancy, kernel fusion, asynchronous transfers, unified memory, multi-GPU scaling
- FPGA, ASIC, TPU, neuromorphic and custom accelerators, heterogeneous integration

[Study GPU and hybrid models →](./HPC-07-Parallel-Programming.md)

## 05. Numerical Methods

### Linear algebra and differential equations

- Direct and iterative solvers, factorization, sparse storage, eigenproblems
- Preconditioning, tensor operations, finite difference/element/spectral methods
- Meshes, boundary conditions, time integration, domain decomposition

### Stochastic and optimization methods

- RNGs, sampling, variance reduction, particle transport, numerical integration
- Gradient and convex methods, genetic algorithms, annealing, swarm and global optimization

[Study numerical methods →](./HPC-10-Numerical-Methods-Scientific-Simulations.md)

## 06. Distributed Systems for HPC

### Cluster and cloud control planes

- Schedulers, resource managers, provisioning, queues, recovery and monitoring
- Virtualization, containers, elastic scaling, orchestration, HPC instances
- Network and storage virtualization

### Distributed state and resilience

- Partitioning, consistency, transactions, consensus and recovery
- Checkpointing, rollback, replication, error detection and containment
- Graceful degradation and resilience engineering

[Study distributed HPC systems →](./HPC-11-Data-I-O-Distributed-Resilience.md)

## 07. Data Management

### Frameworks and data structures

- MapReduce, stream processing, in-memory and graph engines, query optimization
- Hash tables, B-trees, tries, skip lists, spatial indexes, Bloom filters
- Compressed structures and fault-tolerant storage

### I/O and compression

- Parallel, buffered and asynchronous I/O; zero-copy; metadata caching
- File striping and access-pattern optimization
- Lossless/lossy, dictionary, entropy and delta encoding; hardware acceleration

[Study data and I/O →](./HPC-11-Data-I-O-Distributed-Resilience.md)

## 08. Scientific Simulations

### Continuum and particle models

- Navier–Stokes, turbulence, meshing, boundary layers, multiphase flow
- Molecular dynamics, force fields, Verlet integration, neighbor lists
- Solvation, long-range forces and thermodynamic properties

### Earth and space models

- Atmosphere, ocean, climate, data assimilation, ensembles and grid refinement
- N-body, gravitational dynamics, MHD, radiation transport and cosmology
- Stellar evolution and galaxy formation

[Study scientific simulations →](./HPC-10-Numerical-Methods-Scientific-Simulations.md)

## 09. Benchmarking and Testing

### Metrics and suites

- Execution time, FLOPS, speedup, efficiency, bandwidth, throughput and latency
- HPL/LINPACK, HPCG, Graph500, SPEC, STREAM, HPC Challenge, NAS and application kernels

### Scaling and debugging

- Strong/weak scaling, Amdahl/Gustafson, overhead, efficiency and load imbalance
- Parallel debuggers, leak/race/deadlock detection, core dumps, assertions and logging

[Study algorithms and performance →](./HPC-08-Parallel-Algorithms-Performance.md)

## 10. Advanced Topics

### Quantum and neuromorphic computing

- Qubit architectures, quantum algorithms, error correction, simulation and annealing
- Hybrid quantum-classical workflows
- Spiking networks, event-driven processing, memristors and synaptic plasticity

### Edge and green computing

- Device constraints, fog computing, distributed intelligence, local processing
- Real-time response, bandwidth conservation and edge security
- Energy efficiency, power capping, thermals, cooling, renewable energy and carbon accounting

[Study emerging and sustainable systems →](./HPC-12-Emerging-Architectures-Green-Computing.md)
