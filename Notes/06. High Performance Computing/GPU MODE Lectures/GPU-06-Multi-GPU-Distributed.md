# GPU MODE Track 6 — Multi-GPU & Distributed Training

What happens once one GPU is not enough: cheap optimizer steps, how GPUs exchange data (NCCL, NVSHMEM, device-initiated RMA), how a production stack composes parallelisms (TorchTitan), and what breaks when a peer dies mid-collective. Most vocabulary maps one-to-one from MPI; the new parts are GPU streams, NVLink/IB topology, and moving the communication control path into the kernel.

## Contents

- [Collectives & parallelism primer](#collectives--parallelism-primer)
- [Lecture 6 — Optimizing PyTorch Optimizers](#lecture-6--optimizing-pytorch-optimizers)
- [Lecture 17 — GPU Collective Communication (NCCL)](#lecture-17--gpu-collective-communication-nccl)
- [Lecture 39 — TorchTitan](#lecture-39--torchtitan)
- [Lecture 67 — NCCL & NVSHMEM](#lecture-67--nccl--nvshmem)
- [Lecture 70 — Fault-Tolerant Communication Collectives](#lecture-70--fault-tolerant-communication-collectives)
- [Lecture 78 — Iris: Multi-GPU Programming in Triton](#lecture-78--iris-multi-gpu-programming-in-triton)
- [Track summary](#track-summary)
- [Next](#next)

---

## Collectives & parallelism primer

Collectives: broadcast, reduce, all-reduce, all-gather, reduce-scatter, all-to-all, send/recv — same semantics as their `MPI_*` counterparts. Key identity: **all-reduce = reduce-scatter + all-gather**; FSDP/ZeRO keeps the reduce-scatter shard and defers the all-gather until the next forward.

Cost model per message of `m` bytes: `T = α + β·m` (α = latency, β = 1/bandwidth). `p` ranks, `n` bytes.

| Algorithm | Steps | Time (all-reduce of `n` bytes) | Best for |
|---|---|---|---|
| Ring (RS + AG) | `2(p−1)` | `2(p−1)·α + 2·((p−1)/p)·n·β` | large messages: bandwidth-optimal, ≈ `2n` sent per rank regardless of `p` |
| Tree / double binary tree | `≈ 2·log₂p` | `≈ 2·log₂p·α + 2·n·β` (pipelined) | small/medium messages, many nodes |
| Recursive halving/doubling | `2·log₂p` | `2·log₂p·α + 2·((p−1)/p)·n·β` | power-of-two `p`, MPI-classic |
| Direct / one-shot | 1 | `α + (p−1)·n·β` per rank, needs full mesh | tiny messages on NVLink/xGMI |

- Ring latency is linear in `p`, so NCCL switches to trees at scale and for small messages.
- `nccl-tests` busbw normalises algbw by `2(p−1)/p`; compare it to link bandwidth.
- DDP gradient bucketing (`bucket_cap_mb`) amortises α.

| Strategy | What is split | Communication | MPI-world analogue |
|---|---|---|---|
| **DP** (DDP) | batch; full replica per rank | all-reduce grads, overlapped with backward | `MPI_Allreduce` of a global sum |
| **FSDP / ZeRO-3** | batch + params/grads/optimizer state | all-gather params per layer; reduce-scatter grads | distributed array with on-demand gather |
| **TP** | weight matrices (column/row) | all-reduce (or RS+AG with SP) inside each layer; critical path | block-distributed GEMM (SUMMA) |
| **PP** | layers into stages | point-to-point activations; micro-batching fills bubbles | pipeline with `MPI_Send`/`Recv` |
| **CP** | sequence dim of attention | ring exchange of K/V blocks or all-to-all | halo/ring shift |
| **EP** | MoE experts | all-to-all dispatch + combine; load imbalance | `MPI_Alltoallv` |

A **device mesh** (e.g. `[dp_replicate, dp_shard, cp, tp]`) gives each axis its own sub-communicator, like `MPI_Cart_create` + `MPI_Cart_sub`. Put TP innermost on NVLink, DP outermost across IB.

---

## Lecture 6 — Optimizing PyTorch Optimizers

**Slides:** [external](https://docs.google.com/presentation/d/13WLCuxXzwu5JRZo0tAfW0hbKHQMvFw4O/edit#slide=id.p1)

- The optimizer step is **memory- and launch-bound**: a for-loop Adam issues `#params × #ops` tiny kernels, so CPU launch overhead dominates, not FLOPs.
- Three implementations: `foreach=False` (per-tensor loop), `foreach=True` (horizontal fusion: one op across a tensor list), `fused=True` (adds vertical fusion: whole update in one kernel, `p, g, m, v` read and written once).
- `foreach` can raise peak memory because list-wide intermediates are materialised between ops; fused avoids most of this.
- `multi_tensor_apply` packs tensor pointers into kernel args and chunks lists to respect arg limits: launches drop to O(#chunks × #ops) (foreach) or O(#chunks) (fused).
- `torch.compile` on `optimizer.step()` generates fused Triton kernels for any foreach-style optimizer.
- Distributed relevance: the step runs on every replica (DP) or local shard (FSDP) on the critical path after gradient sync; smaller sharded tensors make launch overhead relatively worse.

---

## Lecture 17 — GPU Collective Communication (NCCL)

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L017-NCCL-Collectives.pdf) · [code](https://github.com/gpu-mode/lectures/tree/main/lecture_017)

- NCCL is NVIDIA's GPU collective + point-to-point library — the `MPI_COMM_WORLD` of PyTorch GPU training. DDP's gradient averaging is an NCCL all-reduce that keeps replicas identical.
- DDP registers autograd hooks; the **Reducer** groups ready gradients into **buckets** and launches an async all-reduce per bucket (`ProcessGroupNCCL.cpp`) on a separate stream, overlapping backward compute.
- Communicator init: root creates an `ncclUniqueId`, broadcasts it out-of-band, each process calls `ncclCommInitRank`; in PyTorch, torchrun's c10d store does this.
- **Ring all-reduce** = reduce-scatter (`p−1` steps) + all-gather (`p−1` steps), bandwidth-optimal. **Tree** = reduce + broadcast, better latency at large `p`/small messages (double binary trees).
- NCCL builds rings/trees to match topology (NVLink intra-node, InfiniBand/RoCE inter-node).
- Protocols: **Simple** (highest bandwidth and latency), **LL** (8 B atomic store = 4 B data + 4 B flag; lowest latency, ~50% bandwidth), **LL128** (120 B data + 8 B flag; near-Simple bandwidth, needs 128 B atomicity).
- All-reduce: 3 algorithms × 3 protocols = 9 variants; override with `NCCL_ALGO`, `NCCL_PROTO`.

---

## Lecture 39 — TorchTitan

**Slides:** video only · [code](https://github.com/pytorch/torchtitan)

- PyTorch-native reference platform for large-scale LLM pre-training that composes distributed building blocks rather than a monolithic framework.
- **DeviceMesh:** N-D grid of ranks with named dims; slicing gives each axis's process group.
- **DTensor:** placement per mesh dim — `Shard(dim)`, `Replicate()`, `Partial()`. Redistribution emits the collective: Partial→Replicate = all-reduce, Shard→Replicate = all-gather, Partial→Shard = reduce-scatter.
- **FSDP2 (`fully_shard`):** per-parameter dim-0 sharding via DTensor, replacing FSDP1's flat parameter; composes with TP and enables per-parameter dtypes (e.g. Float8).
- TP + sequence parallel via `ColwiseParallel`/`RowwiseParallel`; **async TP** chunks the collective and GEMM to overlap them. PP via `torch.distributed.pipelining` (GPipe, 1F1B, interleaved, zero-bubble); CP via ring attention.
- Compose FSDP × TP × PP (× CP) on one mesh, TP intra-node. **DCP** saves shards with metadata and reshards on load to change world size or layout.

---

## Lecture 67 — NCCL & NVSHMEM

**Slides:** [external](https://drive.google.com/file/d/1T8uHhFIeVa_g1oYb_O4d2Ltb8YQly1zK/view?usp=sharing) · [Parallel Research Kernels](https://github.com/ParRes/Kernels/tree/main/Cxx11)

| | NCCL | NVSHMEM |
|---|---|---|
| Model | collectives + two-sided send/recv | one-sided PGAS (put/get/atomics) |
| Who initiates | host enqueues a comm kernel on a stream | host or device (`nvshmem_put` from your kernel) |
| Memory | any device buffer | symmetric heap (`nvshmem_malloc`, collective) |
| Sweet spot | bulk-synchronous large collectives (DP, FSDP, TP) | fine-grained, data-dependent traffic (MoE dispatch, fused compute+comm) |
| MPI analogue | MPI collectives/p2p | MPI-3 RMA / OpenSHMEM |

- **Device-initiated** communication lets a kernel push a tile as soon as it is computed, avoiding kernel boundaries and intermediate buffers.
- **Symmetric heap:** collective allocation puts objects at the same offset on every PE, so remote address = peer base + offset, with no per-message exchange.
- One-sided puts need explicit completion/ordering (`quiet`, `fence`, signals) before a consumer reads — like MPI RMA epochs.
- Transports: NVLink/NVSwitch in-node, InfiniBand (incl. GPU-initiated IBGDA) across nodes. NCCL is gaining symmetric-memory and device-side APIs, so the boundary is blurring.
- Rule: NCCL ≈ MPI collectives on GPU buffers; NVSHMEM ≈ OpenSHMEM from CUDA threads. Choose by granularity and whether communication is data-dependent inside the kernel.

---

## Lecture 70 — Fault-Tolerant Communication Collectives

**Slides:** [external](https://docs.google.com/presentation/d/1MKB51lhNOsV-Y_hscSaJk7wZskzxft2pFJQZKyvcMyo/edit?usp=sharing)

- Standard collectives assume a fixed healthy group; one dead rank blocks or poisons the communicator, and the usual fix is restart from checkpoint. At thousands of GPUs, MTBF can be shorter than a useful training interval.
- Failure modes: crash, hung kernel, NIC/link failure, stragglers (indistinguishable from failure without timeouts), and over the internet high latency, NAT and churn.
- NCCL tools (`ncclCommAbort`, async errors, PyTorch watchdog) only detect and tear down; recovery means a new communicator and state resync.
- Design: a membership service defines the world; collectives are abortable/retryable per operation; survivors rebuild the topology and redo or skip the step.
- Joining peers must receive and verify current model/optimizer state before contributing gradients.
- DP tolerates losing one replica's gradient for a step; low-communication methods (DiLoCo-style) make unreliable wide-area links practical. Changing the ring changes reduction order, so results are not bit-identical.

| Approach | Recovery granularity | Cost |
|---|---|---|
| Checkpoint/restart | whole job | lost work + restart |
| torchrun elastic | whole worker group | re-rendezvous + reload |
| Replica-level FT (TorchFT) | one DP replica | step continues with fewer replicas |
| FT collectives library / MPI ULFM | per operation | most engineering, finest grain |

---

## Lecture 78 — Iris: Multi-GPU Programming in Triton

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L078-Iris-Multi-GPU-Triton.pdf)

- Iris: open-source Triton framework giving **SHMEM-like RMA inside Triton** (~370-line core; depends only on Triton, PyTorch, HIP). Scale-up supported; scale-out was work in progress.
- CPU-driven baseline: kernel A, then an RCCL/NCCL comm kernel, then kernel B — bulk-synchronous, cannot start early. Iris is GPU-driven: one fused kernel stores directly to peers' destination buffers as data is produced, with no intermediate buffers.
- Host API is PyTorch-like (`iris.zeros`, `iris.randn`, …) on a symmetric heap; device API is `iris.load/store/put` plus atomics with `sem` (acquire/release/acq_rel/relaxed) and `scope` (cta/gpu/sys).
- **Pointer translation** is pure arithmetic: remote address = peer heap base + (ptr − my heap base); heap bases are all-gathered once at init.
- **Flag sync:** producer stores data then CAS the flag with `sem="release", scope="sys"`; consumer spins with `acquire` before loading.
- GEMM + all-scatter patterns: unfused bulk-synchronous, unfused producer-consumer, fused sequential, fused work-queue, fused workgroup-specialized (split CUs into compute and comm roles). Wave-specialized is not expressible in Triton.
- "Which pattern should I use? All of them." — the winner depends on problem shape.

```python
@triton.jit
def __translate(ptr, from_rank, to_rank, heap_bases):
    offset = tl.cast(ptr, tl.uint64) - tl.load(heap_bases + from_rank)
    to_base = tl.cast(tl.load(heap_bases + to_rank), tl.pointer_type(tl.int8))
    return tl.cast(to_base + offset, ptr.dtype)
```

---

## Track summary

| Concept | Lecture | Takeaway |
|---|---|---|
| foreach / fused optimizers | 6 | Step is launch- and memory-bound; fuse horizontally and vertically. |
| DDP gradient buckets | 17 | Async all-reduce per bucket on a separate stream overlaps backward. |
| Ring vs tree all-reduce | 17 | Ring is bandwidth-optimal (latency ∝ `p`); tree gives `log p` latency. |
| NCCL protocols | 17 | Simple, LL, LL128; 3 algos × 3 protos = 9 variants. |
| DeviceMesh / DTensor | 39 | Placements per mesh axis; redistribution emits the right collective. |
| Composed parallelism | 39 | TP inner (NVLink), FSDP/PP outer; DCP reshards on load. |
| NCCL vs NVSHMEM | 67 | Host-initiated bulk collectives vs device-initiated one-sided PGAS. |
| Symmetric heap | 67, 78 | Remote address = peer base + offset. |
| Fault-tolerant collectives | 70 | Abortable/retryable ops with dynamic membership; recover per step. |
| Iris RMA in Triton | 78 | Pointer translation + `tl.load/store`; GPU owns the control path. |
| Acquire/release flags | 78 | Release on producer, acquire on consumer, `sys` scope across GPUs. |
| Fused compute+comm | 78 | Best pattern is shape-dependent. |

## Next

Continue with [Track 7 — LLM Systems & Inference](./GPU-07-LLM-Systems-Inference.md).
