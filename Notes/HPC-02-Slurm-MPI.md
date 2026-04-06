# HPC Slurm and MPI

This file focuses on the two most common interview topics in traditional HPC platforms: Slurm and MPI.

## Slurm

Slurm is a resource manager and batch scheduler for HPC clusters.

It handles:
- job submission
- queueing
- resource allocation
- task launch
- accounting

## Main Slurm Components

| Component | Role |
|---|---|
| `slurmctld` | controller and scheduler |
| `slurmd` | node daemon |
| `slurmdbd` | accounting database daemon |
| `sbatch` | submit batch jobs |
| `srun` | launch tasks |
| `squeue` | inspect jobs |
| `sinfo` | inspect partitions/nodes |
| `sacct` | inspect job history |

## Slurm Concepts

### Partition

A logical queue or node pool.

Common partitions:
- `debug`
- `cpu`
- `gpu`
- `highmem`
- `long`

### QoS

Controls:
- priority
- runtime limits
- preemption behavior
- usage limits

### Fairshare

Prevents monopolization by lowering priority for users/projects with heavy recent usage.

### Backfilling

Lets small jobs fill gaps without delaying larger reserved jobs.

### GRES

Generic resources such as:
- GPUs
- local SSDs
- licenses

## Slurm Job Lifecycle

1. user writes job script
2. submit with `sbatch`
3. job enters queue
4. scheduler selects nodes when eligible
5. tasks launch via Slurm daemons
6. accounting records usage and outcome

## Common Job States

| State | Meaning |
|---|---|
| `PENDING` | waiting |
| `RUNNING` | executing |
| `COMPLETED` | success |
| `FAILED` | failed |
| `TIMEOUT` | wall time exceeded |
| `CANCELLED` | cancelled |
| `NODE_FAIL` | interrupted by node failure |
| `PREEMPTED` | interrupted by policy |

## Why Slurm Jobs Stay Pending

- insufficient nodes
- fairshare penalty
- QoS or partition limits
- bad or overly large resource request
- fragmentation
- incompatible constraints

## Example Slurm Script

```bash
#!/bin/bash
#SBATCH --job-name=mpi-run
#SBATCH --nodes=4
#SBATCH --ntasks-per-node=32
#SBATCH --time=01:00:00
#SBATCH --partition=compute

module load openmpi
srun --mpi=pmix ./app
```

## MPI

MPI is the standard programming model for distributed-memory parallel jobs.

Use MPI when:
- tasks communicate frequently
- the workload spans many nodes
- performance matters enough to justify explicit communication control

## Core MPI Concepts

- **rank**: one MPI process
- **communicator**: group of ranks
- **point-to-point communication**: send/receive
- **collectives**: broadcast, reduce, all-reduce, gather, scatter

## Why MPI Matters

Multi-node systems do not share memory. MPI makes communication explicit.

This matters because:
- communication cost is real
- synchronization cost is real
- process placement matters

## Common MPI Bottlenecks

- excessive communication
- too many collectives
- load imbalance
- small-message overhead
- poor rank placement
- NUMA locality issues

## Process Placement

A good launch often depends on:
- rank-to-core mapping
- rank-to-socket mapping
- rank-to-GPU mapping
- thread binding

Bad placement causes:
- remote memory access
- noisy collectives
- CPU contention
- GPU locality problems

## MPI + Slurm

In Slurm-managed clusters, `srun` is often preferred because it launches tasks inside the scheduler allocation cleanly.

Typical pattern:

```bash
srun --mpi=pmix ./my_mpi_app
```

## Interview Summary

Good HPC answers about Slurm and MPI usually cover:
- queue policy
- fairness
- placement
- communication bottlenecks
- workload fit

## Related Files

- [HPC.md](./HPC.md)
- [HPC-01-Fundamentals.md](./HPC-01-Fundamentals.md)
- [HPC-03-Storage-Networking-Operations.md](./HPC-03-Storage-Networking-Operations.md)
- [HPC-05-Interviews.md](./HPC-05-Interviews.md)
