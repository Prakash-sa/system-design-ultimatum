# HPC Storage, Networking, and Operations

This file focuses on the infrastructure and operational parts of HPC that often become the real bottlenecks.

## Storage Tiers

### Home

- persistent
- user-facing
- often backed up

### Scratch

- fast
- temporary
- high-throughput
- often purged

### Archive

- low-cost
- durable
- not optimized for active compute I/O

## Why Separate Storage Tiers?

Because performance, cost, and durability goals conflict.

If one storage system is forced to be:
- cheap
- fast
- metadata-heavy
- durable

it usually fails at one or more of those goals.

## Common Storage Options

- NFS
- Lustre
- BeeGFS
- GPFS / Spectrum Scale
- FSx for Lustre
- S3 or other object storage

## Common Storage Problems

- metadata storms
- too many small files
- simultaneous checkpoints
- using home for scratch data
- weak dataset staging strategy

## Networking

For loosely coupled workloads, standard Ethernet may be enough.

For tightly coupled workloads, network performance is often critical.

### Important network metrics

- latency
- bandwidth
- packet/message rate
- jitter
- collective performance

### Common fabrics

- Ethernet
- InfiniBand
- AWS EFA

## RDMA

RDMA reduces communication overhead and helps communication-heavy HPC applications perform better by reducing software and CPU overhead on the data path.

## Why Placement Matters

Good performance depends on:
- rank locality
- NUMA locality
- GPU locality
- rack/fabric locality in some clusters

Poor placement can waste expensive nodes even when utilization appears high.

## Operations

An HPC cluster is not only compute hardware. It is also an operational platform.

### Key operational concerns

- node health checks
- scheduler reliability
- accounting and quotas
- user identity and access
- environment reproducibility
- software version management
- change management
- observability

## What to Monitor

- queue depth
- queue wait time
- CPU/GPU utilization
- node failure rate
- storage throughput
- metadata operation rate
- network congestion/errors
- scheduler latency

## Reproducibility Controls

- modules
- Spack or other pinned environments
- Apptainer containers
- archived job scripts
- recorded runtime metadata

## Benchmarking Basics

Always record:
- hardware type
- software versions
- problem size
- process/thread count
- placement settings
- storage tier used

Without this, benchmark comparisons are often invalid.

## Interview Summary

Strong answers on storage and operations usually show:
- storage tier separation
- awareness of metadata bottlenecks
- understanding that networking is workload-dependent
- operational maturity beyond raw node count

## Related Files

- [HPC.md](./HPC.md)
- [HPC-01-Fundamentals.md](./HPC-01-Fundamentals.md)
- [HPC-02-Slurm-MPI.md](./HPC-02-Slurm-MPI.md)
- [HPC-04-Cloud-ParallelCluster.md](./HPC-04-Cloud-ParallelCluster.md)
- [HPC-06-Computer-Architecture.md](./HPC-06-Computer-Architecture.md) — interconnect topologies, bisection bandwidth, α+βn cost model
- [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md) — MPI-IO and parallel I/O patterns (HDF5, collective I/O)
