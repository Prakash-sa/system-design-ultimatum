# Distributed Systems for Practitioners

Distributed systems are multiple independent computers that cooperate to provide one logical service. Distribution buys scale, availability, geographic reach, and fault isolation, but it removes the guarantees a single process quietly gives us: one clock, one memory space, one failure boundary, and an unambiguous order of events.

This guide focuses on the decisions engineers make in production and in system-design interviews: what can fail, which guarantee matters, what tradeoff is being made, and how the system recovers.

## Table of Contents

1. [The Practitioner Mental Model](#1-the-practitioner-mental-model)
2. [Failures and System Models](#2-failures-and-system-models)
3. [Partitioning](#3-partitioning)
4. [Replication and Quorums](#4-replication-and-quorums)
5. [Consistency, Availability, and CAP](#5-consistency-availability-and-cap)
6. [Transactions and Isolation](#6-transactions-and-isolation)
7. [Distributed Atomicity and Sagas](#7-distributed-atomicity-and-sagas)
8. [Consensus and Replicated State Machines](#8-consensus-and-replicated-state-machines)
9. [Time, Order, and Causality](#9-time-order-and-causality)
10. [Communication and Networking](#10-communication-and-networking)
11. [Security in Distributed Systems](#11-security-in-distributed-systems)
12. [Representative Production Systems](#12-representative-production-systems)
13. [Coordination and Data-Synchronization Patterns](#13-coordination-and-data-synchronization-patterns)
14. [Compatibility and Safe Evolution](#14-compatibility-and-safe-evolution)
15. [Failure Handling and Load Control](#15-failure-handling-and-load-control)
16. [Observability and Distributed Tracing](#16-observability-and-distributed-tracing)
17. [A Practical Design Method](#17-a-practical-design-method)
18. [Interview Questions and Model Answers](#18-interview-questions-and-model-answers)
19. [Review Checklist](#19-review-checklist)

---

## 1. The Practitioner Mental Model

### Why distribute a system?

| Goal | Mechanism | New cost introduced |
|---|---|---|
| More throughput | Partition work across nodes | Rebalancing and cross-partition operations |
| Higher availability | Replicate data and computation | Replica coordination and stale reads |
| Lower latency | Place data near users | Multi-region consistency conflicts |
| Larger datasets | Shard storage | Hot keys and distributed queries |
| Fault isolation | Separate services/cells | Network calls and partial failure |
| Independent delivery | Service ownership boundaries | Version skew and operational overhead |

Distribution is not automatically an improvement. A well-designed modular monolith is often preferable until one machine, one database, one deployment unit, or one team boundary becomes a measured constraint.

### The four questions to ask first

For every important operation, state:

1. **What must always be true?** This is a safety invariant, such as “an order is charged at most once.”
2. **What must eventually happen?** This is a liveness property, such as “a paid order eventually ships.”
3. **Which failures are assumed?** Process crash, slow node, lost packet, partition, disk loss, or region loss?
4. **What is the recovery path?** Retry, fail over, replay, compensate, repair, or require human review?

### Safety, liveness, and performance

- **Safety:** nothing bad happens. Two leaders never commit conflicting values for the same log position.
- **Liveness:** something good eventually happens. A healthy client eventually receives a response.
- **Performance:** it happens within an objective. For example, 99.9% of reads finish within 200 ms.

Safety should not be weakened accidentally to hit a latency target. During a partition, a consensus system commonly sacrifices liveness for safety by refusing writes when it cannot reach a quorum.

### Stateless and stateful services

| Property | Stateless compute | Stateful service |
|---|---|---|
| Request handling | Any instance can usually serve it | Correct node/replica may be required |
| Scaling | Add or remove instances | Move/replicate data and preserve ordering |
| Recovery | Restart or replace | Recover durable state and catch up |
| Examples | API gateway, image transformer | Database, queue, coordination service |

Keep compute stateless when practical, but remember that state still exists somewhere: database rows, object storage, cache entries, queue offsets, or client tokens.

---

## 2. Failures and System Models

### The fallacies of distributed computing

Do not assume that:

- the network is reliable, secure, homogeneous, or zero-latency;
- bandwidth is infinite or transport cost is zero;
- topology never changes;
- there is one administrator;
- clocks agree;
- a timeout proves the remote operation failed.

The last point is central. If a client times out after sending a payment request, the server might have rejected it, committed it, or committed it and lost the response. The outcome is **unknown**, not necessarily failed.

### Useful system models

| Model | Timing assumption | Practical meaning |
|---|---|---|
| Synchronous | Known upper bounds on work and messages | Rarely realistic end-to-end |
| Asynchronous | No timing bounds | A slow node cannot be distinguished from a failed node |
| Partially synchronous | Bounds eventually hold, but are not always known | Common model for practical consensus |

### Failure taxonomy

- **Crash-stop:** a process stops and never returns.
- **Crash-recovery:** it stops and later restarts with durable state intact.
- **Omission:** a message is dropped, or a node fails to send/receive it.
- **Timing:** a correct response arrives too late to be useful.
- **Partition:** groups of healthy nodes cannot communicate.
- **Data corruption:** storage or transmission changes data unexpectedly.
- **Byzantine:** a participant behaves arbitrarily or maliciously.

Most business systems assume crash-recovery and non-Byzantine nodes. Byzantine fault tolerance is justified when participants are mutually distrustful or adversarial; it carries substantially higher complexity and quorum cost.

### Failure detectors are suspicions

Production systems infer failure using timeouts and heartbeats. A timeout cannot distinguish a dead node from a slow node, a congested network, a long garbage-collection pause, or an overloaded dependency. Treat it as a suspicion that triggers a controlled action, not as proof.

### “Exactly once” is an end-to-end property

Networks can duplicate messages, consumers can crash after applying a write but before acknowledging it, and acknowledgements can be lost. Consequently, transport alone rarely guarantees exactly-once business effects.

A practical recipe is:

1. give each logical operation a stable idempotency key;
2. atomically store the key with the resulting state change;
3. return the stored result when the key is seen again;
4. retain deduplication records for at least the retry/redelivery window.

```text
client -- operation_id=op-123 --> service
service transaction:
  if op-123 exists: return previous_result
  else: apply mutation + store(op-123, result)
```

This yields effectively-once effects within a clearly defined scope. It does not make arbitrary external side effects transactional.

---

## 3. Partitioning

Partitioning divides a dataset or workload so each node owns a subset. It is the primary way to scale writes and datasets beyond one machine.

### Common strategies

| Strategy | Strength | Risk | Typical use |
|---|---|---|---|
| Hash partitioning | Even distribution | Range scans fan out | User/account lookup |
| Range partitioning | Efficient range scans | Sequential keys create hot shards | Time/key ranges |
| Directory-based | Flexible placement | Directory is critical metadata | Object/file systems |
| Geographic | Data locality/residency | Uneven demand, cross-region work | Regional user data |
| Tenant-based | Isolation and easy movement | Large tenants become hot | Multi-tenant SaaS |
| Consistent hashing | Limited movement on membership change | Load may still be skewed | Caches, Dynamo-style stores |

For simple hash sharding with `N` fixed shards:

```text
shard = hash(partition_key) mod N
```

Changing `N` remaps most keys, so production systems often use virtual shards or consistent hashing. Virtual shards decouple the logical partition count from the physical node count and make rebalancing more controlled.

### Choosing a partition key

A good key:

- has high cardinality;
- distributes request and storage volume evenly;
- supports the dominant access pattern without fan-out;
- keeps transactions that need atomicity together;
- has a migration plan for unusually large keys or tenants.

The key that spreads data most evenly is not always the right key. Partitioning by `user_id` is excellent for fetching one user's data but poor for a global time-range query. Start from access patterns and invariants.

### Hot-partition mitigations

- Add a time bucket or deterministic suffix to the key.
- Replicate read-heavy hot data into a cache.
- Split exceptional tenants into dedicated partitions.
- Buffer and batch write-heavy counters.
- Use adaptive partition splitting.
- Apply admission control so one key cannot exhaust a shard.

Random suffixes improve distribution but force reads to query and merge all suffix buckets. This is a write/read tradeoff, not a free fix.

### Rebalancing safely

1. Create the destination replica and copy a consistent snapshot.
2. Stream changes made after the snapshot.
3. Catch up and validate counts/checksums.
4. Atomically switch routing metadata.
5. Keep the old owner briefly for forwarding or rollback.
6. Delete the old copy only after the safety window.

Rate-limit rebalancing. Recovery traffic competing with user traffic can turn one node failure into a cluster-wide incident.

---

## 4. Replication and Quorums

Replication keeps multiple copies of data for availability, durability, read scale, or geographic locality.

### Replication topologies

| Topology | Benefits | Tradeoffs |
|---|---|---|
| Single leader / primary-backup | Simple conflict handling, ordered writes | Leader bottleneck and failover gap |
| Multi-leader | Local writes in several regions | Conflict detection/resolution |
| Leaderless | High write availability, tunable quorums | Read repair, hinted handoff, sibling versions |

### Concurrent writes and conflict resolution

Multi-leader and leaderless systems must define what happens when replicas accept concurrent writes:

- **Last-write-wins:** simple, but clock skew or arbitrary tie-breaking can silently discard a valid write.
- **Application merge:** preserve siblings and let domain logic or a user combine them.
- **Commutative operation:** represent “increment” or “add item” rather than overwriting a whole value.
- **CRDT:** use a data type whose concurrent updates merge deterministically, accepting its metadata and semantic constraints.

Conflict resolution belongs to the data model. A shopping cart may merge item additions; two concurrent assignments of the same hotel room must instead coordinate around the exclusivity invariant.

### Synchronous versus asynchronous replication

- **Synchronous:** acknowledge after required replicas persist the write. Lower risk of acknowledged data loss; higher latency and lower availability.
- **Asynchronous:** acknowledge before followers persist it. Lower write latency; failover may lose recent acknowledged writes.
- **Semi-synchronous:** wait for one or a subset of replicas, balancing the two.

Always say what “persist” means: received in memory, appended to an OS buffer, written to a local durable log, or replicated across failure domains.

### Leader failover hazards

Failover requires leader failure detection, candidate selection, promotion, client rerouting, and old-leader fencing. Without a term/epoch check, a paused old leader can return and continue accepting writes—a **split brain**.

Use monotonically increasing terms and reject writes from an older term:

```text
write(term=41) accepted by storage at term 41
old leader resumes and sends write(term=40)
storage rejects it because 40 < 41
```

### Quorum reasoning

For `N` replicas, write quorum `W`, and read quorum `R`, the common rule:

```text
W + R > N
```

means the read and write sets overlap. It is useful, but overlap alone does **not** guarantee linearizability. The system must also handle concurrent writes, version selection, sloppy quorums, failed writes, repair, and membership changes correctly.

Typical configuration:

```text
N = 3, W = 2, R = 2
```

This tolerates one unavailable replica for reads and writes, assuming the two reachable replicas are part of the authoritative replica set.

### Anti-entropy and repair

- **Read repair:** reconcile divergent replicas during reads.
- **Hinted handoff:** temporarily store a write for an unavailable replica.
- **Merkle trees/checksums:** compare ranges efficiently and repair differences.
- **Background repair:** continuously detect and reconcile drift.

Replication without tested repair is delayed data loss.

---

## 5. Consistency, Availability, and CAP

### Consistency models

| Model | Guarantee | Example expectation |
|---|---|---|
| Linearizability | Each operation appears atomic between call and response | After a successful password change, no later read returns the old password |
| Sequential consistency | All clients observe one operation order, not necessarily real-time order | Operations look serial but may lag wall time |
| Causal consistency | Causes are visible before their effects | A reply is never visible before its parent post |
| Read-your-writes | A client sees its own completed writes | Updated profile appears immediately to that user |
| Monotonic reads | A client never moves backward in observed versions | Refresh does not show older data |
| Eventual consistency | Replicas converge if writes stop | DNS/cache entries converge over time |

Consistency is often selectable per operation. A product catalog can tolerate stale reads; inventory reservation and leader election usually cannot.

### Related guarantee hierarchy

- **Linearizability** applies to individual operations and respects real-time order.
- **Serializability** applies to transactions and requires equivalence to some serial execution, but that serial order need not respect wall-clock order.
- **Strict serializability** combines serializability with real-time ordering.
- **Snapshot isolation** provides a consistent snapshot but is weaker than serializability because it can permit write skew.

Stronger models make more histories illegal and usually require more coordination. Do not compare replication consistency and transaction isolation as though they were one interchangeable ladder; state which history and which scope the guarantee covers.

### CAP, precisely

When a network partition occurs, a distributed operation must choose between:

- **Consistency (C):** every response preserves the chosen consistency guarantee, possibly by rejecting or delaying requests.
- **Availability (A):** every request to a non-failing node receives a non-error response, possibly with stale or conflicting data.
- **Partition tolerance (P):** the system continues operating despite communication loss between nodes.

Real distributed systems cannot prevent partitions, so the operational choice during a partition is normally C versus A **for a particular operation**. CAP does not say a system is always only “CP” or “AP,” and its C means linearizability, not generic database correctness.

### PACELC

PACELC adds the normal case:

```text
if Partition: choose Availability or Consistency
Else: choose Latency or Consistency
```

Even without a partition, synchronous cross-region coordination improves consistency at the cost of round-trip latency.

### Selecting a model by invariant

| Requirement | Likely choice |
|---|---|
| Unique username | Linearizable conditional write or single owner |
| Social like count | Eventual counter; exactness may be delayed |
| User sees own post | Session routing or read-your-writes token |
| Inventory must not oversell | Atomic reservation on authoritative partition |
| Search index | Eventual projection from source of truth |
| Feature flag kill switch | Strong or bounded-staleness reads, fail-safe default |

“Eventual” must include a bound or operating target when the business cares: under normal load, 99.9% of updates appear within 5 seconds, with backlog alarms when that target is missed.

---

## 6. Transactions and Isolation

### ACID in practical terms

- **Atomicity:** all effects of a transaction commit or none do.
- **Consistency:** application invariants hold before and after the transaction.
- **Isolation:** concurrent transactions behave according to a specified model.
- **Durability:** committed state survives the failures covered by the storage design.

ACID consistency is about application/database invariants. CAP consistency is a distributed read/write ordering property. They are different uses of the word.

### Common anomalies

| Anomaly | What happens |
|---|---|
| Dirty read | A transaction reads another transaction's uncommitted data |
| Non-repeatable read | Re-reading a row returns a newer committed value |
| Phantom | Re-running a predicate returns a different row set |
| Lost update | One concurrent write overwrites another |
| Write skew | Transactions read the same snapshot and update different rows, violating a joint invariant |

### Isolation levels

| Isolation | Commonly prevents | Still watch for |
|---|---|---|
| Read committed | Dirty reads | Non-repeatable reads, lost updates, write skew |
| Repeatable read | Dirty/non-repeatable reads | Engine-dependent phantoms and write skew |
| Snapshot isolation | Reads see one snapshot; many lost updates prevented | Write skew across different rows |
| Serializable | All committed transactions equal some serial order | Abort/retry rate and coordination cost |

Names differ across database engines; verify actual behavior rather than trusting the label.

### Pessimistic concurrency control

Lock before conflicting access.

```sql
BEGIN;
SELECT available
FROM inventory
WHERE sku = 'A-42'
FOR UPDATE;

UPDATE inventory
SET available = available - 1
WHERE sku = 'A-42' AND available > 0;
COMMIT;
```

Good when conflicts are frequent or the cost of retry is high. Risks include deadlocks, lock convoys, long-held locks, and reduced concurrency. Use a stable lock order and keep transactions short.

### Optimistic concurrency control

Read a version and conditionally write only if it has not changed.

```sql
UPDATE documents
SET body = :new_body, version = version + 1
WHERE id = :id AND version = :expected_version;
```

If zero rows change, re-read and retry or surface a conflict. OCC is effective when contention is low and operations are easy to retry.

### Preventing write skew

Snapshot isolation can allow two doctors to independently go off-call after each sees the other on-call. Prevent this by:

- using serializable isolation;
- locking a shared predicate/guard row;
- materializing the invariant into one row updated conditionally;
- redesigning ownership so one partition serializes the decision.

---

## 7. Distributed Atomicity and Sagas

### Two-phase commit (2PC)

2PC coordinates one atomic decision across transactional participants.

```text
Phase 1 — prepare
coordinator -> participants: can you commit T?
participants: durably record prepared state and vote yes/no

Phase 2 — decide
if every vote is yes: coordinator durably records COMMIT
otherwise: coordinator durably records ABORT
coordinator -> participants: final decision
```

**Strength:** atomic commit when participants and logs recover according to the protocol.

**Costs:** participants hold locks/resources while prepared; coordinator recovery can delay progress; every participant must support the protocol; cross-region latency is expensive. 2PC is a commit protocol, not a consensus algorithm, and classic 2PC can block while the decision is unavailable.

### Three-phase commit (3PC)

3PC adds a pre-commit phase to reduce blocking under strong timing and failure assumptions. Network partitions violate those assumptions, so it is uncommon in production databases. Consensus-backed transaction coordinators are generally more practical.

### Quorum/consensus-backed commit

A replicated coordinator records the transaction decision through consensus. This removes a single coordinator failure as a long-term blocking point, but participants may still retain resources while resolving an in-doubt transaction.

### Sagas

A saga is a sequence of local transactions with compensating actions.

```text
reserve inventory -> charge payment -> create shipment

if shipment fails:
  refund payment -> release inventory
```

| Style | Benefits | Risks |
|---|---|---|
| Orchestration | Central workflow and status are easy to inspect | Orchestrator coupling/bottleneck |
| Choreography | Loose coupling through events | Hidden flow, event cycles, harder debugging |

Compensation is a new business operation, not time reversal. A refund may fail, an email cannot be “unsent,” and prices may change. Each step and compensation needs idempotency, retries, durable status, and escalation for terminal failure.

### Transactional outbox

Avoid the dual-write bug—database commit succeeds but event publish fails—by writing the domain change and an outbox row in one local transaction. A relay publishes unsent rows and marks them delivered. Consumers still deduplicate because publication can repeat.

```text
DB transaction:
  update orders set status = 'PAID'
  insert into outbox(event_id, type, payload)

relay:
  read unpublished outbox rows -> publish -> record delivery
```

For deeper pattern coverage, see [System Design Patterns](11-Design-Patterns.md).

---

## 8. Consensus and Replicated State Machines

### The consensus problem

Non-faulty nodes must:

- **agree** on one value;
- decide only a **valid** proposed value;
- decide at most once (**integrity**);
- eventually decide when the required conditions hold (**termination**).

Consensus is used for leader election, configuration metadata, membership, locks, and ordering a replicated log. It should protect small, critical coordination state—not become a high-volume data path by default.

### FLP impossibility

In a fully asynchronous system, no deterministic consensus algorithm can guarantee termination if even one process may crash. This does not mean consensus is impossible in practice. Systems use partial synchrony, timeouts, randomized behavior, and failure detectors: safety is preserved at all times, while liveness resumes when the network becomes sufficiently well behaved.

### Raft at a glance

Raft nodes are followers, candidates, or leaders. Time is divided into monotonically increasing terms.

1. A follower starts an election after missing leader heartbeats.
2. It increments its term, votes for itself, and requests votes.
3. A majority elects a leader, normally requiring the candidate's log to be sufficiently up to date.
4. The leader appends commands to its log and replicates them.
5. An entry is committed after the required majority rule is satisfied.
6. Every node applies committed entries to the same deterministic state machine in order.

```text
client -> leader: SET x=7
leader log: [term 8, index 42, SET x=7]
leader -> followers: append entry
majority acknowledges
leader commits index 42, applies it, responds
followers learn commit index and apply in order
```

Important implementation details include election randomization, log matching, term checks, durable vote/log storage, snapshots, membership changes, and safe linearizable reads.

### Paxos versus Raft

- **Paxos** defines a family of protocols for reaching agreement; Multi-Paxos uses a stable leader for a sequence of log positions.
- **Raft** packages similar majority-based replicated-log ideas around explicit leader election, log replication, and membership changes for understandability.

Neither protocol makes arbitrary application code deterministic or removes the need to handle client retries. A leader can commit an operation and crash before responding, so clients still need stable request IDs.

### Replicated state machine requirements

- Commands are deterministic.
- All replicas apply the same committed order.
- External nondeterminism—current time, randomness, network results—is captured in the command or handled outside the application.
- Snapshots include an exact applied-log position.
- Side effects are emitted idempotently after commit.

### Membership changes

Replacing the old voter set with a new set in one unsafe step can create two independent majorities. Correct implementations use joint consensus or another protocol-defined transition in which old and new configurations overlap safely.

---

## 9. Time, Order, and Causality

### Physical clocks

Wall clocks drift, are adjusted by NTP, and can jump forward or backward. Do not use wall-clock timestamps alone for mutual exclusion, exact event ordering, or elapsed-time measurement.

- Use a **monotonic clock** for timeouts and durations.
- Use UTC wall time for human-facing timestamps and approximate event time.
- Carry explicit versions/terms for correctness.

### Total and partial order

- A **total order** compares every pair of events.
- A **partial order** compares events only when their causal relationship is known.

If event `a` may have influenced event `b`, then `a` happened-before `b`. Concurrent events are not ordered by causality.

### Lamport clocks

Each process keeps a counter:

1. Increment before a local event.
2. Attach the counter to outgoing messages.
3. On receive, set `clock = max(local, received) + 1`.

If `a` happened-before `b`, then `L(a) < L(b)`. The reverse is not guaranteed; Lamport clocks cannot tell whether two events were concurrent. Add a stable node ID to break ties and construct a total order when needed.

### Vector clocks

Each node maintains a counter per participant. For vectors `A` and `B`:

- `A` precedes `B` if every component of `A <= B` and at least one is smaller;
- if neither vector dominates the other, the versions are concurrent.

Vector clocks capture causality but metadata grows with participants. Version vectors and dotted version vectors compact causal history and are useful for replicated key-value stores.

### Hybrid logical clocks

An HLC combines physical time with a logical counter. It remains close to wall time while preserving causal ordering despite small clock corrections. It is useful for database versions and snapshots, but its correctness still depends on the algorithm's stated clock-skew assumptions.

### Distributed snapshots

The Chandy-Lamport algorithm records a consistent global cut without stopping the system, assuming reliable FIFO channels. A process records local state on the first marker, records subsequent in-flight messages on other channels until their markers arrive, and combines those records into the snapshot.

Snapshots help checkpoint streaming jobs, detect stable properties, and reason about in-flight work. They do not imply every component was observed at the same physical instant.

---

## 10. Communication and Networking

### Layer-aware reasoning

| Layer | Concern | Examples |
|---|---|---|
| Link | Local network delivery | Ethernet, Wi-Fi |
| Network | Addressing and routing | IP |
| Transport | Process-to-process delivery | TCP, UDP, QUIC |
| Application | Semantics and data format | HTTP, gRPC, DNS, Kafka protocol |

TCP provides an ordered byte stream, not application messages, request deduplication, or proof that an operation was processed. Applications must define framing, deadlines, retry semantics, and idempotency.

### Synchronous and asynchronous communication

| Model | Best when | Main risk |
|---|---|---|
| Request/response | Caller needs an immediate answer | Temporal coupling and cascading latency |
| Queue | Work can be buffered and handled by one consumer | Redelivery and backlog |
| Pub/sub | Multiple consumers need the same event | Schema evolution and slow subscribers |
| Stream/log | Ordered replay and independent offsets matter | Partition ordering and retention management |

### Deadlines, timeouts, and cancellation

- A **timeout** limits how long one component waits.
- A **deadline** is the remaining end-to-end budget and should propagate downstream.
- **Cancellation** tells dependencies that abandoned work is no longer useful.

If a gateway has 800 ms left, a service should not start three sequential calls with independent 500 ms timeouts. Allocate the remaining budget and preserve time for cleanup/fallback.

### Serialization

- Use a versioned schema for long-lived APIs/events.
- Prefer additive changes: new optional fields and tolerant readers.
- Include explicit units, currencies, time zones, and enum fallback behavior.
- Limit message size and nesting before decoding untrusted payloads.
- Do not reuse removed field numbers in formats such as Protocol Buffers.

### Ordering scope

Global ordering is expensive and rarely necessary. Define the narrowest useful scope: per account, order, user, device, or partition. Route the entity's events by a stable key and reject stale sequence numbers at the consumer.

For protocol selection and delivery patterns, see [Communication Patterns](05-Communication-Patterns.md) and [REST & gRPC Best Practices](09-REST-gRPC-Best-Practices.md).

---

## 11. Security in Distributed Systems

Security properties include authentication (who), authorization (may they), confidentiality (who can read), integrity (was it changed), and availability (can legitimate users access it).

### TLS and mutual TLS

TLS provides encryption in transit, server authentication, and integrity. A simplified handshake:

1. Client proposes protocol/cipher options and key-share material.
2. Server selects parameters and sends its certificate chain.
3. Client validates hostname, trust chain, validity period, and policy.
4. Both derive symmetric session keys.
5. Encrypted, integrity-protected application traffic begins.

With mTLS, both sides present certificates. This is useful for workload identity, but authorization still needs policy: a valid certificate proves identity, not permission for every action.

### Public-key infrastructure

PKI binds public keys to identities using certificate authorities. Operating it safely requires:

- short-lived certificates and automated rotation;
- protected private keys;
- explicit trust roots and hostname/workload verification;
- revocation or rapid expiry;
- monitoring for expiration and issuance failures.

PGP's web-of-trust model decentralizes identity attestation. It is useful in some user-centric workflows but is not the normal model for service-to-service TLS.

### OAuth 2.0 and OpenID Connect

- **OAuth 2.0** delegates authorization to access a resource.
- **OpenID Connect (OIDC)** adds an identity layer for authentication.

Use authorization code flow with PKCE for user-facing clients. Validate issuer, audience, signature, expiry, nonce/state as applicable, redirect URI, and granted scopes. Keep access tokens short-lived; rotate refresh tokens and protect them as credentials.

### Practical service security

- Authenticate and authorize at each trust boundary.
- Use workload identity instead of static shared secrets.
- Apply least privilege to data, queues, and control-plane APIs.
- Encrypt sensitive data at rest and in transit.
- Rotate keys without coordinated downtime.
- Rate-limit abusive identities and expensive operations.
- Avoid secrets and sensitive payloads in logs/traces.
- Record security-relevant decisions in tamper-resistant audit logs.

For implementation detail, see [Security Best Practices](12-Security-Best-Practices.md).

---

## 12. Representative Production Systems

The goal of case studies is not memorizing products. It is seeing how system requirements select mechanisms.

### Distributed file systems: GFS and HDFS

Typical architecture:

- a metadata service tracks namespace, file-to-block mapping, and replica placement;
- storage workers hold large replicated blocks/chunks;
- clients ask metadata for locations, then transfer data directly with workers;
- large blocks reduce metadata and favor streaming throughput over tiny random I/O.

GFS was designed for large files, append-heavy workloads, commodity-machine failures, and application-aware consistency. HDFS follows similar manager/worker ideas. The metadata plane must be durably replicated or recoverable; storage replicas need checksums, heartbeats, re-replication, and rack/failure-domain awareness.

### Coordination: ZooKeeper

ZooKeeper exposes a small hierarchical namespace of znodes, versioned updates, ephemeral nodes, and watches. Its Zab protocol provides ordered replication with one leader and quorum acknowledgement.

Build higher-level primitives with care:

- **membership:** ephemeral node per live member;
- **leader election:** ephemeral sequential nodes; watch the immediate predecessor;
- **configuration:** versioned znode plus watch;
- **lock:** ephemeral sequential contenders, again watching the predecessor to avoid a herd.

Watches are notifications to re-check state, not durable business event queues. A client must handle session expiry and reinstall watches.

### Wide-column stores: Bigtable/HBase

Rows are sorted by row key and partitioned into tablets/regions. A write commonly enters a write-ahead log and memory table, then immutable sorted files; background compaction merges files. Design row keys around reads and avoid monotonically increasing prefixes that funnel all writes to one region.

### Dynamo-style store: Cassandra

Cassandra partitions by a hashed key, replicates across nodes, and offers tunable consistency levels. Writes flow through a commit log and memtable to SSTables; compaction and repair maintain storage and replica convergence.

`QUORUM` reads and writes can provide strong results only under the exact topology and conflict rules assumed. Multi-key transactions and global scans are not its strength. Model tables around queries.

### Globally consistent SQL: Spanner

Spanner combines partitioned storage, synchronous replication through consensus, distributed transactions, and bounded clock uncertainty via TrueTime. Commit wait ensures externally consistent transaction timestamps after uncertainty has passed. The lesson is not “clocks solve consensus”; precise uncertainty bounds plus consensus and transaction protocols enable stronger global semantics at a latency cost.

### Messaging: Kafka

Kafka partitions an append-only log. A partition leader orders records, followers replicate them, and consumers track offsets. Consumer groups assign a partition to at most one member of the group at a time.

Key decisions:

- key by the entity requiring order;
- choose acknowledgements and minimum in-sync replicas for durability;
- make producers idempotent when duplicate appends matter;
- commit consumer offsets only in coordination with effects;
- monitor lag, under-replicated partitions, disk, and rebalance frequency;
- use transactions only where their Kafka-defined scope matches the requirement.

“Exactly once” in Kafka does not automatically make a write to an unrelated external database exactly once.

### Cluster management: Kubernetes

Kubernetes is a reconciliation system:

- the API server exposes desired/current objects;
- etcd stores authoritative control-plane state;
- controllers observe and drive current state toward desired state;
- the scheduler assigns pods to nodes;
- kubelets make assigned pod state real.

Controllers must tolerate repeated and stale observations. Reconciliation should be idempotent, status conditions should be explicit, and finalizers should guard cleanup without becoming permanent deletion blockers.

### Distributed ledgers

Permissioned systems such as Corda coordinate mutually known organizations and share transaction data with relevant parties rather than broadcasting everything globally. Ledger designs add digital signatures, identity, immutable histories, and contract verification, but they do not remove data-governance, privacy, key-management, or schema-evolution problems.

Use a ledger when parties lack one trusted database owner and shared verification is the core requirement—not merely because data is replicated.

### Data processing: MapReduce, Spark, and Flink

| System | Core model | Best fit |
|---|---|---|
| MapReduce | Materialized map/shuffle/reduce stages | Large, robust batch jobs |
| Spark | DAG execution with cached datasets | Iterative batch, SQL, mixed analytics |
| Flink | Stateful streaming with checkpoints and event time | Continuous low-latency pipelines |

The shuffle is the expensive distributed boundary: it incurs serialization, network, disk, skew, and coordination. Partition carefully and treat skewed keys explicitly.

In event-time streaming:

- **event time** is when the source says an event occurred;
- **processing time** is when the system handles it;
- a **watermark** estimates that events earlier than a point are mostly complete;
- allowed lateness and update/retraction policy define how late data changes results.

Checkpointing source positions and operator state consistently enables recovery. End-to-end correctness still depends on replayable sources and transactional or idempotent sinks.

---

## 13. Coordination and Data-Synchronization Patterns

### Prefer ownership to coordination

The cheapest distributed lock is one you do not need. Route all mutations for an entity to one owner/partition, use conditional writes, or serialize through a log before adding a lock service.

### Leases, fencing, and distributed locks

A lease grants ownership for a bounded time. A process can pause beyond its lease, resume, and wrongly believe it still owns the resource. Therefore a lease alone is unsafe for an external resource.

Use a monotonically increasing **fencing token**:

```text
worker A obtains token 71, then pauses
worker B obtains token 72 and writes successfully
worker A resumes and writes with token 71
storage rejects 71 because it has already observed 72
```

Correctness depends on the protected resource enforcing the token. If it cannot, the lock does not fully fence stale owners.

### Event sourcing

Store immutable domain events as the source of truth and derive current state by replay/projection. It provides history and flexible projections but introduces event-versioning, replay, snapshotting, privacy deletion, and eventual-consistency challenges. Events should describe durable facts, not low-level CRUD diffs.

### Change Data Capture (CDC)

CDC reads a database log and publishes row changes. It is useful for search indexing, caches, analytics, and migrations. Track a durable source position, preserve per-key ordering, make consumers idempotent, and define behavior for schema changes and snapshot-to-stream handoff.

CDC exposes storage-level changes; a transactional outbox provides explicit domain events. Choose based on consumer semantics.

### Shared-nothing architecture

Each node owns its CPU, memory, and disk and communicates over the network. This supports horizontal scale and fault isolation but pushes cross-node joins, rebalancing, skew, consistency, and operations into the software.

Shared-nothing does not mean “shares nothing conceptually.” Nodes still share protocols, schemas, routing metadata, and operational dependencies.

### Orchestration versus choreography

Use orchestration when the workflow needs a visible state machine, deadlines, compensation, or operator intervention. Use choreography for simple event reactions with few participants. A long implicit chain of events is an orchestrator hiding in the topology; make it explicit before it becomes unmanageable.

---

## 14. Compatibility and Safe Evolution

Distributed deployments always contain version skew: rolling upgrades, delayed consumers, mobile clients, replayed events, and restored backups.

### Compatibility definitions

- **Backward compatible:** new code can read old data/messages, or an evolved producer remains usable by old consumers depending on the stated perspective.
- **Forward compatible:** old code can tolerate data/messages written by new code.
- **Full compatible:** both directions are supported.

Always name the reader and writer; compatibility terminology is otherwise easy to reverse.

### Expand-contract migration

1. **Expand:** add the new field/API/table without removing the old one.
2. Deploy readers that accept both representations.
3. Deploy writers that populate the new representation, dual-writing only when necessary.
4. Backfill and validate historical data.
5. Switch reads to the new representation.
6. Stop old writes and observe through a safety window.
7. **Contract:** remove the old representation in a later release.

### Rules for durable events and APIs

- Add optional fields with safe defaults.
- Never change the meaning or unit of an existing field in place.
- Preserve unknown fields where the format/workflow requires round-tripping.
- Give enums an unknown fallback.
- Version behavior, not every cosmetic schema edit.
- Test new producers against old consumers and the reverse.
- Retain old schemas as long as events can be replayed.

---

## 15. Failure Handling and Load Control

### Retries

Retry only when the error is transient and the operation is safe to repeat. Use:

- a strict attempt/deadline budget;
- exponential backoff;
- random jitter;
- idempotency keys for mutations;
- server hints such as `Retry-After`;
- metrics distinguishing initial attempts from retries.

```text
delay = random(0, min(cap, base * 2^attempt))   # full jitter
```

Layered retries multiply. Three attempts at the gateway, service, and database client can produce up to 27 database attempts for one user request. Assign retry responsibility to one suitable layer.

### Circuit breaker

```text
CLOSED -- failures exceed threshold --> OPEN
OPEN -- cooldown expires --> HALF_OPEN
HALF_OPEN -- probes succeed --> CLOSED
HALF_OPEN -- probe fails --> OPEN
```

A breaker prevents repeated work against a failing dependency. It needs a bounded fallback and should not hide sustained failure.

### Bulkheads and cells

Partition connection pools, worker pools, queues, tenants, or regions so one failure cannot consume all capacity. A cell architecture repeats a complete slice of the service and assigns users to cells, reducing blast radius at the cost of capacity overhead and routing complexity.

### Backpressure and overload

Backpressure tells producers to slow down when consumers are saturated.

Preferred responses, in order:

1. Bound concurrency and queues.
2. Reject early with a clear retry signal.
3. Shed optional or low-priority work.
4. Degrade expensive features.
5. Autoscale if startup time is shorter than the overload duration.

An unbounded queue converts overload into high latency and memory exhaustion. Little's Law (`L = lambda * W`) explains why: at a fixed arrival rate, growing wait time means growing work in the system.

### Load shedding and admission control

Make the decision near the system edge, but protect each scarce resource independently. Use per-tenant limits to preserve fairness and reserve capacity for health checks, control-plane traffic, and recovery.

### Disaster recovery

- **RPO (Recovery Point Objective):** maximum tolerable data loss measured in time.
- **RTO (Recovery Time Objective):** maximum tolerable time to restore service.

Backups, replication, and failover serve different failure modes. Replication quickly copies accidental deletion or corruption; backups with tested point-in-time recovery protect against it. Run restoration and regional-failover exercises rather than assuming configuration equals recoverability.

For more implementation patterns, see [Scalability & Reliability](06-Scalability-Reliability.md).

---

## 16. Observability and Distributed Tracing

### Three complementary signals

- **Metrics:** aggregated rates, errors, durations, saturation, queue depth, and business outcomes.
- **Logs:** discrete structured events with enough context to investigate.
- **Traces:** a request's causal path across process boundaries.

### Trace model

A trace contains spans. Each span has a trace ID, span ID, parent, operation name, timestamps, status, and selected attributes. Propagate context through HTTP/RPC headers and asynchronous message metadata.

```text
trace 9af...
  API POST /orders           420 ms
    inventory.reserve        35 ms
    payment.authorize       310 ms
      database conditional   18 ms
    outbox.commit            22 ms
```

### Instrumentation rules

- Preserve trace context at service and queue boundaries.
- Add stable IDs such as request, order, tenant, and message ID where privacy allows.
- Record retries and queue time as distinct spans/events.
- Keep span names low-cardinality; put IDs in attributes.
- Redact secrets, tokens, and personal data.
- Use tail-based sampling for errors and unusually slow traces when possible.

### What to alert on

Alert on user-visible symptoms and exhausted error budgets: availability, tail latency, correctness failures, saturation, consumer lag, and replication/repair backlog. Avoid paging solely because a machine metric crossed a threshold unless it predicts real impact.

### Debugging a distributed failure

1. Define affected users, operations, regions, and time window.
2. Check golden signals: traffic, errors, latency, saturation.
3. Follow representative traces across boundaries.
4. Correlate logs by trace/request/message ID.
5. Check recent deploys, configuration, dependency health, and backlog.
6. Mitigate blast radius before perfect diagnosis.
7. Preserve evidence and build a causal incident timeline.

---

## 17. A Practical Design Method

Use this order in a design review or interview.

### Step 1: Define requirements and invariants

- Core user flows and out-of-scope features
- Read/write volume, object size, retention, and growth
- Latency percentiles, availability target, RPO, and RTO
- Consistency and ordering per operation
- Security, privacy, residency, and audit constraints
- Invariants that must survive retries and concurrency

### Step 2: Estimate scale

Calculate approximate average and peak QPS, bandwidth, storage growth, cache working set, and partition size. The point is to expose dominant constraints, not manufacture false precision.

```text
daily writes = 100 million
average write QPS = 100,000,000 / 86,400 ~= 1,160
peak at 8x average ~= 9,300 writes/s

1 KB/event * 100 million/day ~= 100 GB/day before replication/indexing
```

### Step 3: Draw the simplest viable data flow

Start with client, edge/load balancer, stateless service, primary datastore, and object storage/cache/queue only where requirements justify them. Name the source of truth.

### Step 4: Choose data model and partition key

List critical queries and mutations. Co-locate data participating in the same invariant, then evaluate hot keys, fan-out, rebalancing, and tenant isolation.

### Step 5: State failure and consistency behavior

For each dependency: timeout, retry owner, idempotency mechanism, fallback, queue bound, and reconciliation path. Explain what the user observes when a node, zone, or region fails.

### Step 6: Close operational gaps

Add observability, capacity headroom, schema evolution, backup/restore, rebalancing limits, deployment strategy, security boundaries, and cost controls.

### Decision record template

```text
Decision:
Requirement/invariant:
Chosen mechanism:
Alternatives rejected:
Tradeoffs accepted:
Failure behavior:
Metrics and rollback trigger:
```

### Common design mistakes

- Claiming “exactly once” without an idempotency/deduplication boundary.
- Saying “CAP means pick two” without describing partition behavior.
- Adding Kafka, Redis, and microservices before identifying a constraint.
- Treating retries as harmless.
- Using a distributed lock without fencing.
- Ignoring hot keys, repair traffic, or rebalancing.
- Naming an isolation level without the invariant it protects.
- Designing only the happy path and not recovery.
- Promising multi-region writes without conflict semantics.
- Giving averages while ignoring tail latency and peak load.

---

## 18. Interview Questions and Model Answers

### Q1: A client times out while creating an order. Should it retry?

**Answer:** The timeout leaves the result unknown. Retry with the same idempotency key. The order service atomically associates that key with the created order/result and returns the prior result for duplicates. Set a retry deadline and reconcile any downstream asynchronous work from durable order/outbox state.

### Q2: Does `R + W > N` guarantee strong consistency?

**Answer:** It guarantees read/write quorum intersection under the assumed authoritative replica set. Linearizability additionally needs correct version/term handling, coordination of concurrent writes, no unsafe sloppy-quorum substitution, and a read algorithm that returns the latest completed value. Quorum arithmetic alone is insufficient.

### Q3: When would you choose availability over consistency during a partition?

**Answer:** For operations where temporary divergence is reversible and preferable to rejection—likes, presence, catalog browsing, or telemetry ingestion. I would preserve availability, attach versions, define conflict resolution, and repair later. For uniqueness, authorization changes, money movement, or scarce inventory, I would usually reject/queue writes that cannot reach the authoritative quorum.

### Q4: Why can snapshot isolation still violate an invariant?

**Answer:** Concurrent transactions can read the same snapshot and update different rows, so write-write conflict detection never triggers. This produces write skew. Use serializable isolation, a shared guard-row lock, or remodel the invariant into one conditional write.

### Q5: Why is 2PC considered blocking?

**Answer:** After voting yes, a participant has promised it can commit and may hold locks while awaiting the final decision. If it cannot recover that decision from the coordinator, it cannot safely choose commit or abort independently. Replicating the decision via consensus improves coordinator availability but does not erase all resource-holding costs.

### Q6: How do you stop two leaders from writing after failover?

**Answer:** Use consensus/terms for leader election and fencing tokens on writes. Every protected storage target rejects commands with a term/token older than the highest it has observed. A lease or heartbeat by itself is insufficient because an old leader can pause and resume.

### Q7: How would you preserve order in an event system?

**Answer:** First narrow the requirement to per entity or aggregate. Partition by that stable entity key, assign one ordered log per partition, include sequence/version numbers, make processing idempotent, and reject or buffer stale/out-of-order versions. Avoid global ordering unless the business invariant truly requires its coordination cost.

### Q8: What happens when a Kafka consumer writes to a database and crashes before committing its offset?

**Answer:** Kafka redelivers the record and the database write may repeat. Make the database mutation idempotent using the event ID/sequence in the same transaction, or use an inbox table. Committing the offset first instead risks data loss, so it is not the fix.

### Q9: Why not put every operation behind a distributed lock?

**Answer:** Locks reduce concurrency, add a coordination dependency, complicate failure recovery, and remain unsafe against paused stale owners unless the resource enforces fencing. Prefer partition ownership, conditional writes, commutative operations, or single-key transactions where possible.

### Q10: How do you diagnose growing queue lag?

**Answer:** Compare arrival and service rates, then inspect consumer saturation, error/retry rate, partition skew, downstream latency, rebalance history, and poison messages. Bound retries, isolate bad records, add safe consumer capacity, and shed optional producers if needed. Scaling consumers beyond the partition count will not increase parallelism.

### Q11: When is a saga better than a distributed transaction?

**Answer:** When work spans services or long-lived business steps that cannot hold database locks or participate in one transaction manager. A saga accepts visible intermediate states and uses compensations. Choose it only after defining those states, idempotency, compensation failures, and operator recovery.

### Q12: What should be strongly consistent in an otherwise eventually consistent system?

**Answer:** Keep the smallest state that protects invariants strongly consistent—ownership metadata, uniqueness claims, balances/reservations, configuration versions—while making derived views, search, analytics, feeds, and caches asynchronous. This limits coordination to where correctness needs it.

---

## 19. Review Checklist

Before calling a distributed design complete, verify:

### Correctness

- [ ] Safety invariants and liveness goals are explicit.
- [ ] Consistency and ordering scope are defined per operation.
- [ ] Concurrent updates and isolation anomalies are addressed.
- [ ] Duplicate, late, and out-of-order messages are safe.
- [ ] Locks/leases use fencing where stale owners can cause damage.

### Failure and recovery

- [ ] Timeouts are deadlines, not proof of failure.
- [ ] Retries are bounded, jittered, and idempotent.
- [ ] Queues and concurrency are bounded.
- [ ] Split-brain prevention and failover behavior are explained.
- [ ] Repair, replay, backup restore, and regional recovery are tested.
- [ ] RPO and RTO match the design.

### Scale and operation

- [ ] Partition key, hot-key behavior, and rebalancing are covered.
- [ ] Peak load and tail latency—not only averages—are estimated.
- [ ] Recovery traffic has capacity and rate limits.
- [ ] Metrics, logs, traces, and business correctness signals exist.
- [ ] Schema/API/event evolution supports version skew and replay.
- [ ] Security boundaries, identity, authorization, and key rotation are clear.

### Final rule

Every mechanism should map to a requirement or failure mode. If removing a component changes neither correctness, scale, latency, security, nor operability, the component probably does not belong in the design.
