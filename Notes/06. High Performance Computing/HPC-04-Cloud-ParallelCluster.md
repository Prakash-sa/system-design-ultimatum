# Cloud HPC and AWS ParallelCluster

This file focuses on cloud HPC design, especially on AWS.

## Why Cloud HPC?

Cloud HPC is useful when you need:
- burst capacity
- rapid provisioning
- flexible instance choices
- project-based clusters

Cloud HPC is less attractive when you need:
- stable ultra-high utilization
- maximum low-latency performance at all times
- strict on-prem data locality

## Cloud HPC Design Questions

Before choosing tooling, ask:
- Is the workload tightly coupled?
- Is it independent batch?
- Does it checkpoint?
- Is spot acceptable?
- How large is the dataset?
- How expensive is data movement?

## AWS ParallelCluster

AWS ParallelCluster is a cluster deployment and management tool for HPC on AWS.

It commonly manages:
- head node
- Slurm scheduler
- compute fleets
- storage integration
- EFA-enabled networking

## Typical ParallelCluster Architecture

```text
Users
  |
  v
[Login / Head Node]
  |- Slurm
  |- Cluster config
  |
  v
[Compute Queues]
  |- CPU
  |- GPU
  |- Spot
  |- On-demand
  |
  v
[Storage]
  |- FSx for Lustre
  |- EBS
  |- EFS
  |- S3
```

## Storage Mapping on AWS

| Need | AWS choice |
|---|---|
| shared scratch | FSx for Lustre |
| durable datasets | S3 |
| lighter shared home | EFS |
| node-local temp space | local NVMe / instance store |

## Compute and Network Mapping

### Tightly coupled MPI

Prefer:
- homogeneous instance types
- EFA-enabled instances
- placement groups
- on-demand first unless restart behavior is strong

### Independent batch

Prefer:
- flexible instance pools
- spot-heavy strategies
- simpler storage path

### GPU training

Prefer:
- homogeneous GPU generations per queue
- locality-aware launches
- strong checkpointing plan
- fast dataset access

## Spot vs On-Demand

Use spot when:
- jobs are restartable
- checkpointing exists
- tasks are independent or interruption-tolerant

Avoid spot when:
- jobs are tightly coupled
- restart is expensive
- deadlines are strict

## Cost Governance

Cloud HPC often fails from cost drift, not technical impossibility.

Add:
- project tagging
- budget alarms
- queue-specific policies
- idle resource cleanup
- explicit spot/on-demand rules

## Interview Summary

Strong cloud HPC answers show:
- correct workload classification
- service choice justified by workload, not by brand familiarity
- storage and networking mapped explicitly
- cost and interruption strategy included

## Related Files

- [HPC.md](./HPC.md)
- [HPC-01-Fundamentals.md](./HPC-01-Fundamentals.md)
- [HPC-03-Storage-Networking-Operations.md](./HPC-03-Storage-Networking-Operations.md)
- [HPC-05-Interviews.md](./HPC-05-Interviews.md)
- [HPC-08-Parallel-Algorithms-Performance.md](./HPC-08-Parallel-Algorithms-Performance.md) — scaling studies, benchmarks, checkpoint-interval math
