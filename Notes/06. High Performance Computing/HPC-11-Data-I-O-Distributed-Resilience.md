# Data, I/O, Distributed Systems, and Resilience for HPC

At scale, the control plane and data path determine whether compute is useful. This guide covers cluster management, cloud abstractions, distributed state, parallel I/O, data structures, compression, and recovery as one end-to-end system.

## Cluster Management

An HPC cluster separates responsibilities:

- **scheduler** decides which eligible job should run next;
- **resource manager** tracks nodes, CPUs, memory, GPUs, licenses, topology, and allocations;
- **node agent** launches and monitors work on each compute node;
- **provisioner** creates/configures nodes and images;
- **identity/accounting** maps users/projects to quotas, usage, and policy;
- **monitoring** observes node health, queues, filesystems, networks, and jobs.

Slurm combines scheduling and resource management through controllers, `slurmd` agents, and optional accounting services. Kubernetes is designed around long-running services and reconciliation; it can run batch workloads but does not replace topology-aware HPC scheduling by default.

## Scheduling and Queues

### What a scheduler optimizes

- high utilization without starving users;
- policy/fair-share and project priorities;
- short wait time and predictable starts;
- topology, GPU, memory, license, and locality constraints;
- backfilling small jobs without delaying reserved high-priority jobs;
- recovery from failed or drained nodes.

### Workload characterization

Useful scheduling attributes include runtime estimate, moldability, checkpointability, node count, memory per node, accelerators, network sensitivity, local-scratch needs, and job dependencies. Bad wall-time estimates waste backfill opportunities or kill jobs prematurely.

Queue monitoring should distinguish demand from supply problems: pending by reason, wait-time percentiles, requested versus used memory, fragmentation, failed launches, preemption, and per-partition utilization.

## Node Provisioning and Cloud HPC

### Virtualization and containers

- Virtual machines provide isolation and hardware abstraction but may add startup/placement complexity.
- Containers package user space while sharing the host kernel. Apptainer is common in HPC because it supports unprivileged execution, shared filesystems, MPI/GPU integration, and immutable images.
- Containers do not virtualize NUMA, network topology, accelerators, or kernel capabilities; performance still depends on the host.

### Elastic cluster pattern

1. A stable head/control plane receives jobs.
2. Queue demand triggers node provisioning.
3. Instances join the scheduler, run health checks, and become allocatable.
4. Jobs stage data, execute, checkpoint, and publish results.
5. Idle nodes drain and terminate after a policy delay.

Elasticity fits bursty queues and independent jobs. Tightly coupled jobs need homogeneous instances, placement guarantees, low-latency fabric, synchronized startup, and often capacity reservation.

### Virtualized network and storage

Cloud network/storage abstractions separate logical configuration from physical placement. Treat advertised bandwidth as a ceiling and verify instance-size limits, burst behavior, multi-tenant variability, EFA/RDMA support, filesystem throughput, and data-transfer cost.

## Failure Domains and Recovery

Failures occur at task, process, node, rack/AZ, control-plane, storage, and application levels. Recovery design starts by naming the failure domain and the state that must survive it.

- A scheduler can requeue a job after node failure, but only the application knows how to resume useful work.
- A replicated controller protects scheduling state, not application memory.
- A durable checkpoint protects application progress, not corrupt science.
- Cross-region copies improve disaster recovery but add cost and a larger recovery point objective.

## Checkpoint and Restart

### Checkpoint forms

- **coordinated**: all ranks write a consistent global epoch; simple restart, synchronization/I/O burst;
- **uncoordinated**: ranks checkpoint independently; risks domino rollback without message logging;
- **incremental/differential**: write only changed state; less bandwidth, more restore complexity;
- **multi-level**: frequent node-local/NVRAM checkpoints plus less frequent parallel-filesystem/object-store copies;
- **application-level**: explicit scientific state; portable and compact;
- **system-level**: captures process/runtime state; transparent but less portable.

Use atomic publication: write a new generation, flush/validate, then update a small manifest or rename. Never overwrite the only known-good checkpoint in place.

The Young/Daly intuition chooses an interval from checkpoint cost and failure rate: frequent checkpoints waste time; rare checkpoints lose more recomputation.

## Replication, Rollback, and Graceful Degradation

- Replicate small critical metadata aggressively; replicating petabytes of transient simulation state is rarely economical.
- Roll back to the newest validated checkpoint and make job output idempotent so retries do not duplicate results.
- Fault containment prevents a bad node/rank from corrupting unrelated jobs or shared state.
- Graceful degradation may use fewer ensemble members, lower resolution, or partial service, but only when the scientific/SLA contract defines acceptable quality.
- Algorithm-based fault tolerance encodes checksums or redundant calculations into linear algebra to detect or correct errors.

## Distributed State: Partitioning and Consistency

HPC control planes and metadata services use ordinary distributed-systems principles even when compute kernels use MPI.

### Partitioning

- **range partitioning** supports ordered scans but can hotspot;
- **hash partitioning** spreads load but scatters ranges;
- **consistent hashing** reduces movement as nodes change;
- **directory/metadata partitioning** must avoid hot directories and centralized lookup bottlenecks.

### Consistency models

- **linearizable** operations appear to occur at one instant and simplify locks/leader decisions;
- **serializable transactions** preserve a serial ordering across multiple operations;
- **snapshot isolation** gives consistent reads but allows some write anomalies;
- **eventual consistency** favors availability/latency when stale reads are acceptable.

Choose per invariant. Scheduler ownership and quota charging need strong rules; replicated monitoring samples often do not.

### Consensus and distributed transactions

Raft/Paxos-style consensus agrees on an ordered log despite failures; it is for small critical metadata, not bulk scientific arrays. Two-phase commit coordinates atomic transactions but can block on coordinator failure unless paired with a replicated log/recovery protocol. Sagas compensate multi-step workflows when strict atomicity is impractical.

## Data Paths and Storage Tiers

| Tier | Purpose | Desired behavior |
|---|---|---|
| local NVMe / burst buffer | temporary shuffle, staging, checkpoint absorption | high bandwidth/IOPS, node-local failure domain |
| parallel scratch | active shared datasets and checkpoints | aggregate throughput, stripe control, purge policy |
| project/home | code, configs, modest persistent data | durability, quotas, backup; not giant I/O bursts |
| object/archive | durable source/result datasets | low cost, lifecycle policy, high latency/batch transfer |

Stage input before compute, use scratch during execution, and publish only durable outputs. Retention/lifecycle policy is part of the workflow, not cleanup after the fact.

## Parallel Filesystems

Lustre, Spectrum Scale/GPFS, BeeGFS, and managed equivalents separate metadata service from data targets.

- **Striping** distributes file extents across storage targets. More stripes can raise large-file bandwidth but increase coordination and contention.
- **Metadata** operations (create, stat, open, rename, list) can bottleneck long before byte throughput.
- A file-per-rank pattern creates namespace storms; a single shared file can create lock/contention problems. Use collective I/O or a bounded number of aggregator files.
- Storage-area networks expose block devices; parallel filesystems add a shared namespace and concurrency semantics above storage devices.

## Parallel and Buffered I/O

### MPI-IO and collective I/O

MPI file views describe each rank's logical region. Collective operations allow **two-phase I/O**: aggregators exchange data with ranks, then issue large contiguous filesystem operations. HDF5 and NetCDF provide self-describing formats above MPI-IO.

### Buffering and asynchronous I/O

- Buffer many tiny records into large aligned transfers.
- Double-buffer so compute fills one buffer while another is written.
- Asynchronous APIs help only if the storage stack and application have independent work; a later immediate wait provides no overlap.
- Dedicated I/O ranks/services can absorb and transform output but must be provisioned so they do not become the bottleneck.

### Zero-copy and direct paths

Zero-copy reduces intermediate CPU memory copies by using memory mapping, scatter/gather, RDMA, GPUDirect Storage, or direct I/O. Alignment, pinning, page-cache behavior, and device support matter. Fewer copies do not guarantee lower latency if setup or small-transfer overhead dominates.

## Metadata Caching and Access Patterns

Cache immutable or versioned metadata; invalidate carefully when directories/files mutate. Batch `stat`/open operations and avoid repeated global namespace scans. Store per-timestep fields in chunked datasets aligned with expected reads.

Access-pattern rules:

- contiguous, large, aligned requests maximize throughput;
- random small I/O needs high IOPS and often local staging;
- match chunk/stripe geometry to decomposition and analysis queries;
- separate checkpoint traffic from bursty analysis when possible;
- measure both bandwidth and metadata operations per second.

## Data Structures for High-Performance Data Systems

| Structure | Best at | HPC/data-system concern |
|---|---|---|
| hash table | expected O(1) key lookup | locality, resize pauses, skew |
| B/B+ tree | ordered range queries and block storage | page size, concurrency, write amplification |
| prefix trie | prefix/routing lookup | pointer overhead; compressed/radix variants |
| skip list | ordered concurrent structure | randomized levels, cache behavior |
| spatial index (R/k-d tree) | geometric neighborhood/range queries | high-dimensional degradation, repartitioning |
| Bloom filter | compact membership rejection | false positives, no false negatives |
| compressed bitmap | set/filter operations | excellent for sparse/dense runs depending encoding |

Distributed graph engines partition vertices/edges; in-memory engines trade durability/capacity for latency; stream processors trade bounded batch completion for continuous event-time/state management.

## Big-Data Frameworks in an HPC Context

- **MapReduce** materializes shuffle stages and recovers tasks; robust for throughput, inefficient for tightly coupled iteration.
- **DAG engines** keep intermediate data in memory and optimize a multi-stage plan.
- **stream processors** maintain partitioned state, checkpoints, watermarks, and replayable sources.
- **graph engines** use vertex-centric or edge-centric iterations with irregular communication.
- **query optimizers** choose join order, partitioning, broadcast versus shuffle, vectorized execution, and predicate pushdown.

Use these for data preparation/analysis when fault recovery and elastic throughput matter. Use MPI/accelerator kernels for tightly coupled numerical phases. Production workflows often combine them.

## Compression

### Families

- **lossless**: exact reconstruction; required for many checkpoints and integer/metadata fields;
- **lossy**: controlled error; valuable for floating scientific fields when tolerance is explicit;
- **dictionary coding**: replaces repeated symbols/strings with codes;
- **entropy coding**: Huffman/arithmetic/ANS encode frequent symbols compactly;
- **delta/predictive coding**: stores differences from prior values or predictions;
- **quantization/transform coding**: reduces precision or changes basis before coding.

Compression is worthwhile when saved I/O/network time exceeds CPU/GPU encoding cost. Hardware or GPU acceleration can keep compression off the critical path. Real-time pipelines need bounded latency and streaming state, not just maximum ratio.

### Scientific lossy compression

Define error in domain terms: absolute/relative pointwise bounds, conserved quantities, spectral error, feature preservation, or downstream-analysis accuracy. Validate restarts and analysis, not only compression ratio.

## Observability and Error Detection

Collect infrastructure and application signals together:

- scheduler decisions, pending reasons, launches, requeues;
- node ECC/thermal/network/storage errors;
- filesystem target and metadata latency;
- per-rank progress, phase timers, residuals, conservation checks;
- checkpoint generations and validation status;
- structured logs with job, rank/node, timestep, and correlation IDs.

Assertions catch violated invariants close to the source. Core dumps and stack traces need matching symbols/build IDs. Central logs must be sampled/rate-limited so a failing thousand-rank job does not become an outage.

## Resilience Design Checklist

1. Name failure domains and acceptable data loss/downtime.
2. Separate authoritative, reproducible, cached, and disposable data.
3. Make work units retryable and output publication idempotent.
4. Validate checkpoints before declaring them current.
5. Replicate critical metadata and test leader/control-plane failover.
6. Inject node, network, filesystem, and partial-write failures.
7. Monitor recovery time and correctness, not just failure detection.

## Interview / Exam Summary

- Scheduling balances policy, fit, utilization, and topology—not simply FIFO order.
- Elastic cloud capacity does not guarantee low-jitter placement for tightly coupled work.
- Strong consistency is for invariants; bulk arrays need scalable data paths.
- Parallel I/O succeeds by aggregating small/strided requests and controlling metadata.
- Checkpointing must be atomic, validated, multi-generation, and aligned to failure domains.
- Compression and caching are data-movement optimizations with correctness contracts.

## Related Files

- [HPC-00-Learning-Roadmap.md](./HPC-00-Learning-Roadmap.md)
- [HPC-02-Slurm-MPI.md](./HPC-02-Slurm-MPI.md)
- [HPC-03-Storage-Networking-Operations.md](./HPC-03-Storage-Networking-Operations.md)
- [HPC-04-Cloud-ParallelCluster.md](./HPC-04-Cloud-ParallelCluster.md)
- [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md)
