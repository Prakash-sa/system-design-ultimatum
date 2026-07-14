# HPC Fundamentals

This file is the short focused companion to [HPC.md](./HPC.md). Use it when you want the core mental model without the full interview-heavy master guide.

## What is HPC?

High Performance Computing (HPC) is the use of many compute resources together to solve problems that are too large, too slow, or too time-sensitive for a single machine.

Typical workloads:
- weather simulation
- CFD
- molecular dynamics
- genomics
- Monte Carlo simulation
- AI training

## The Core Goal

HPC is mainly about:
- parallelism
- time-to-solution
- throughput
- efficient use of compute, memory, network, and storage

## HPC vs Distributed Systems

| Dimension | HPC | General Distributed Systems |
|---|---|---|
| Goal | time-to-solution, throughput | availability, elasticity |
| Workload | batch, simulation, training | online serving, APIs |
| Network needs | often very low latency | usually standard Ethernet is enough |
| Failure handling | checkpoint/restart is common | retries and replication are common |

## Core Terms

- **Node**: one machine in the cluster
- **Core**: execution unit inside a CPU
- **Socket**: physical CPU package
- **NUMA**: memory locality matters by socket
- **Rank**: one MPI process
- **Thread**: execution context inside a process
- **Job**: unit submitted to scheduler
- **Partition/Queue**: policy-managed pool of resources

## Workload Shapes

### Embarrassingly parallel

Tasks are independent.

Examples:
- parameter sweeps
- Monte Carlo
- rendering

Best fits:
- job arrays
- cloud batch
- spot capacity in many cases

### Tightly coupled

Tasks communicate frequently.

Examples:
- CFD
- climate models
- linear algebra solvers

Best fits:
- MPI
- premium network fabric
- shared scratch storage

### Hybrid

MPI across nodes plus threads or GPUs within nodes.

Examples:
- MPI + OpenMP
- MPI + CUDA

## Scaling Concepts

### Strong scaling

Same problem size, more resources.

Question:
- does runtime go down?

### Weak scaling

Problem size grows with resources.

Question:
- does runtime stay roughly constant?

### Amdahl's Law

Serial code limits maximum speedup.

### Gustafson's Law

Bigger systems let you solve bigger problems, not only fixed problems faster.

## The 5-Layer HPC Mental Model

1. workload shape
2. execution model
3. scheduler and policy
4. infrastructure
5. operations

## Quick Interview Frame

When asked any HPC design question:

1. classify the workload
2. decide if it is independent, tightly coupled, GPU-heavy, or hybrid
3. map that to scheduler, storage, and network
4. explain reliability and cost tradeoffs

## Related Files

- [HPC.md](./HPC.md)
- [HPC-02-Slurm-MPI.md](./HPC-02-Slurm-MPI.md)
- [HPC-03-Storage-Networking-Operations.md](./HPC-03-Storage-Networking-Operations.md)
- [HPC-04-Cloud-ParallelCluster.md](./HPC-04-Cloud-ParallelCluster.md)
- [HPC-05-Interviews.md](./HPC-05-Interviews.md)
