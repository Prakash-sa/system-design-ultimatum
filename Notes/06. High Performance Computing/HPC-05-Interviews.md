# HPC Interview Prep

This file is the focused interview companion to [HPC.md](./HPC.md).

## Fast Interview Framework

For almost any HPC design question:

1. classify the workload
2. choose execution model
3. choose scheduler and policy
4. choose compute, network, and storage
5. discuss reliability, cost, and operations

## Questions Interviewers Commonly Ask

- What is HPC?
- When do you use MPI?
- What is Slurm and what problems does it solve?
- Why do jobs stay pending?
- Why does an MPI job stop scaling?
- How would you design a shared research cluster?
- How would you design a cloud HPC platform?
- How do you decide between standard Ethernet and EFA/InfiniBand?
- What storage tiers would you create and why?
- How do you make the platform reproducible?

## What Strong Answers Usually Include

- correct workload classification
- clear distinction between embarrassingly parallel and tightly coupled work
- scheduler policy, not just hardware
- storage and network as first-class design choices
- checkpointing and failure handling
- cost or quota awareness in shared environments

## Red Flags in Interview Answers

- recommending MPI for independent tasks
- ignoring storage bottlenecks
- assuming more nodes always helps
- describing only tools and no tradeoffs
- forgetting fairness, quotas, or multi-tenancy

## Good One-Minute Answer Template

"I would start by classifying the workload. If it is tightly coupled, I would use MPI, premium network, and high-performance scratch storage. If it is embarrassingly parallel, I would use job arrays or batch scheduling and optimize for throughput and cost instead. Then I would define partitions and policy in Slurm, separate home, scratch, and archive storage, and add checkpointing, observability, and quota controls."

## Company-Specific Angle

### AWS-style

Emphasize:
- elasticity
- service tradeoffs
- cost governance
- ParallelCluster and storage mapping

### NVIDIA-style

Emphasize:
- GPU topology
- NCCL collectives
- data feeding and checkpointing

### Enterprise/platform-style

Emphasize:
- multi-tenancy
- identity
- reproducibility
- operational maturity

## Practice Prompts

1. Design an HPC cluster for CFD.
2. Design a university research cluster.
3. Design a Monte Carlo batch platform.
4. Design a multi-node GPU training environment.
5. Explain when cloud HPC is a bad idea.

## Last-Minute Revision List

- Slurm = scheduler/resource manager
- MPI = tightly coupled distributed memory
- OpenMP = shared-memory threading
- NUMA = memory locality matters
- EFA/InfiniBand = for communication-heavy scaling
- scratch != archive
- checkpointing matters
- classify workload before choosing tools

## Related Files

- [HPC.md](./HPC.md)
- [HPC-01-Fundamentals.md](./HPC-01-Fundamentals.md)
- [HPC-02-Slurm-MPI.md](./HPC-02-Slurm-MPI.md)
- [HPC-04-Cloud-ParallelCluster.md](./HPC-04-Cloud-ParallelCluster.md)
- [HPC-06-Computer-Architecture.md](./HPC-06-Computer-Architecture.md) — for architecture questions (caches, NUMA, false sharing, roofline)
- [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md) — for coding questions (OpenMP clauses, MPI deadlocks, CUDA)
- [HPC-08-Parallel-Algorithms-Performance.md](./HPC-08-Parallel-Algorithms-Performance.md) — for theory questions (Amdahl variants, isoefficiency, canonical algorithms)
