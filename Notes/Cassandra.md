# Apache Cassandra - Complete Deep Dive

## What is Cassandra?

**Apache Cassandra** is a distributed NoSQL database designed for high availability and horizontal scalability that enables:
- **Linear scalability**: Add nodes to increase throughput
- **No single point of failure**: Peer-to-peer architecture (no master)
- **High write throughput**: Millions of writes/second
- **Eventual consistency**: Trade strong consistency for availability
- **Multi-datacenter support**: Built-in geographic distribution
- **Tunable consistency**: Choose per query (consistency level)

### Core Characteristics

| Aspect | Benefit |
|--------|---------|
| **Distributed** | Peer-to-peer, all nodes equal |
| **Fault-tolerant** | Lose nodes, keep operating (RF=3) |
| **Scalable** | Linear throughput increase per node |
| **Durable** | Write-ahead logging + compaction |
| **Multi-DC** | Replicate across datacenters natively |
| **Eventually consistent** | High availability over strong consistency |

---

## Cassandra Architecture Overview

<details>
<summary>Click to view code</summary>

```
Client (via CQL driver)
       ↓
Cassandra Cluster
  ├─ Node 1 (Replicates: A-H)
  ├─ Node 2 (Replicates: I-P)
  ├─ Node 3 (Replicates: Q-Z)
  ├─ Node 4 (Replicates: A-H, I-P)
  └─ ...
       ↓
   [Token Ring] → [Hash Partitioning]
       ↓
   [SSTable (commit log + memtable)]
```

</details>

**Key layers:**
- **Cluster**: Collection of nodes sharing same cluster name
- **Node**: Single Cassandra instance
- **Keyspace**: Database-like container (schema definition)
- **Table**: Similar to relational database table
- **Partition Key**: Determines which node stores data
- **Token Ring**: Maps keys to nodes via consistent hashing
- **Replica**: Copy of partition on multiple nodes (replication factor)

---

## Core Components

### 1. Consistent Hashing & Token Ring

**Problem**: How to distribute data across nodes?

**Solution**: Consistent hashing with token ring

<details>
<summary>Click to view code</summary>

```
Token Ring (0 to 2^63-1):

      Node 1 (Token: 100)
             /\
       Node 2   Node 4
     (Token:    (Token:
      200)      400)
         \        /
        Node 3 (Token: 300)

Key "alice" → Hash → Token 150
  Belongs to: Node 1 (100-200)
  
Key "bob" → Hash → Token 250
  Belongs to: Node 3 (200-300)
  
Key "charlie" → Hash → Token 350
  Belongs to: Node 4 (300-400)
```

</details>

**Benefits:**
- Adding/removing nodes = minimal rebalancing
- Load balanced: Each node owns ~1/N of token space
- Replication: RF=3 means data on 3 consecutive nodes

**Replication placement:**

<details>
<summary>Click to view code</summary>

```
Replication Factor = 3

Key "user:123" → Token 150
  Primary (Node 1): Token 100-200
  Replica 1 (Node 2): Token 200-300
  Replica 2 (Node 3): Token 300-400
```

</details>

---

### 2. Keyspaces and Tables

**Keyspace**: Schema definition (similar to database)

<details>
<summary>Click to view code (cql)</summary>

```cql
CREATE KEYSPACE user_keyspace
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'us-east-1': 3,
  'eu-west-1': 2
}
AND durable_writes = true;
```

</details>

**Table**: Data structure (similar to table)

<details>
<summary>Click to view code (cql)</summary>

```cql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email TEXT,
  name TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

</details>

---

### 3. Data Model: Primary Key

**Simple primary key** (single column):
<details>
<summary>Click to view code (cql)</summary>

```cql
PRIMARY KEY (user_id)
  → Partition key: user_id
  → Clustering key: (none)
  
// All data with same user_id on same partition
```

</details>

**Composite primary key** (partition key + clustering key):
<details>
<summary>Click to view code (cql)</summary>

```cql
CREATE TABLE user_activity (
  user_id UUID,
  timestamp TIMESTAMP,
  action_type TEXT,
  action_data TEXT,
  PRIMARY KEY (user_id, timestamp)
);

WHERE user_id = ? AND timestamp >= ? AND timestamp < ?
```

</details>

**How it's stored:**

<details>
<summary>Click to view code</summary>

```
Partition key (user_id): Determines node
Clustering key (timestamp): Sort order within partition

Data on node:
  Partition: user_id=alice
    ├─ timestamp=2024-01-05 10:00:00 → "login"
    ├─ timestamp=2024-01-05 10:15:30 → "view_product"
    └─ timestamp=2024-01-05 10:30:45 → "logout"
  
  Partition: user_id=bob
    ├─ timestamp=2024-01-05 10:02:00 → "login"
    └─ timestamp=2024-01-05 10:05:15 → "purchase"
```

</details>

**Advantages:**
- Range queries: Get activity between timestamps efficiently
- Sorted results: Clustering key order preserved
- Efficient pagination: Skip to timestamp and fetch next N rows

---

### 4. Write Path

**Write operation flow:**

<details>
<summary>Click to view code</summary>

```
Client sends INSERT/UPDATE
       ↓
1. Write to commitlog (durability)
       ↓
2. Write to memtable (in-memory, sorted)
       ↓
3. Return success to client (write durability achieved)
       ↓
4. Periodically flush memtable → SSTable (on disk)
       ↓
5. Compaction merges SSTables
```

</details>

**Write acknowledgment flow:**

<details>
<summary>Click to view code</summary>

```
Client sends write with consistency_level = QUORUM
       ↓
Coordinator node:
  - Sends to all RF replicas
  - Waits for QUORUM responses (RF/2 + 1)
  - Returns success
       ↓
Consistency achieved:
  QUORUM = 3 nodes → need 2 acks
  If 1 node slow/down → still succeed
  Trade-off: Eventual consistency
```

</details>

---

### 5. Read Path

**Read operation flow:**

<details>
<summary>Click to view code</summary>

```
Client sends SELECT with consistency_level = QUORUM
       ↓
Coordinator node:
  - Queries primary replica + (RF-1) other replicas
  - Compares timestamps (read repair)
  - Returns latest version
       ↓
Read consistency guarantees:
  ONE: Fastest (1 node)
  QUORUM: Balanced (RF/2 + 1 nodes)
  ALL: Slowest but consistent (all RF nodes)
```

</details>

**Read repair:**

<details>
<summary>Click to view code</summary>

```
Scenario: Write to replica A succeeds, B is slow

Write to A (timestamp 100): SUCCESS
Write to B (timestamp 100): SLOW/TIMEOUT

Later, read from A and B:
  A: timestamp 100
  B: timestamp 90 (stale)
  
Read repair:
  Coordinator sees A > B
  Sends write to B to fix stale data
  Returns A's value
```

</details>

---

## Consistency & Availability Trade-offs

### Consistency Levels

| Level | Read from | Write to | Availability | Consistency |
|-------|-----------|----------|--------------|-------------|
| **ONE** | 1 node | 1 node | Highest | Lowest (stale) |
| **QUORUM** | RF/2 + 1 | RF/2 + 1 | Medium | Medium |
| **LOCAL_QUORUM** | Local DC quorum | Local DC quorum | Medium | Medium |
| **ALL** | All replicas | All replicas | Lowest (1 failure = fail) | Highest |

**Write consistency example** (RF=3):

<details>
<summary>Click to view code</summary>

```
Consistency ONE:
  Write to node A → Return success
  Risk: Nodes B,C haven't written yet (data loss if A fails)

Consistency QUORUM:
  Write to nodes A,B,C → Wait for 2 acks → Return success
  Risk: 1 node can fail safely

Consistency ALL:
  Write to nodes A,B,C → Wait for all 3 acks → Return success
  Risk: 1 node down = write fails (low availability)
```

</details>

**Hybrid consistency** (write QUORUM, read ONE):

<details>
<summary>Click to view code</summary>

```
Write QUORUM:
  Ensure at least 2 replicas have data

Read ONE:
  Read from fastest replica (very fast)
  Risk: Might be stale
  Mitigation: Read repair fixes stale data in background
```

</details>

---

## Replication & Distribution

### Replication Factor (RF)

<details>
<summary>Click to view code</summary>

```
RF=1: No replication (data loss on node failure)
RF=2: One replica (lose 1 node, still serve)
RF=3: Two replicas (lose 2 nodes, still serve)
RF=5: Four replicas (lose 4 nodes, still serve)

Production: Use RF=3 minimum
Multi-DC: Distribute replicas across DCs
  us-east: RF=2
  eu-west: RF=1
```

</details>

### Multi-Datacenter Replication

<details>
<summary>Click to view code (cql)</summary>

```cql
CREATE KEYSPACE events
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'us-east-1': 3,      // 3 replicas in US
  'eu-west-1': 2       // 2 replicas in EU
};
```

</details>

**Data flow:**

<details>
<summary>Click to view code</summary>

```
Write in US-East:
  1. Write to primary + replicas (US-East)
  2. Replicates asynchronously to EU-West
  3. EU replicas eventually consistent

Benefits:
  - Local reads (low latency)
  - Local writes (high throughput)
  - Automatic cross-DC replication

Trade-off:
  - Eventual consistency (EU lags behind US)
  - Cross-DC bandwidth usage
```

</details>

---

## Compaction Strategy

**Problem**: Many writes create many SSTables (slow reads)

**Solution**: Compaction merges SSTables

<details>
<summary>Click to view code</summary>

```
Initial state (4 SSTables):
  SSTable1: Keys A, M, Z
  SSTable2: Keys A, G, M
  SSTable3: Keys B, K, X
  SSTable4: Keys C, D, L

Read request for key M:
  Check SSTable1 (found)
  Check SSTable2 (might have newer)
  Check SSTable3 (no)
  Check SSTable4 (no)
  → Query multiple SSTables (slow)

After compaction:
  SSTable-merged: Keys A, B, C, D, G, K, L, M, X, Z (sorted)
  → Single SSTable (fast)
```

</details>

**Compaction strategies:**

| Strategy | Use Case | Trade-off |
|----------|----------|-----------|
| **Size-tiered** | Default, write-heavy | More read overhead |
| **Leveled** | Read-heavy | More write overhead |
| **Time-window** | Time-series data | Good balance for events |

---

## Performance Optimization

### Write Optimization

<details>
<summary>Click to view code (cql)</summary>

```cql
-- Batch writes for throughput
BEGIN BATCH
  INSERT INTO users (user_id, email) VALUES (?, ?)
  INSERT INTO user_index (email, user_id) VALUES (?, ?)
APPLY BATCH;

-- Async writes (fire-and-forget)
consistency_level = ONE
timeout = 100ms

-- Tune commit log settings
commitlog_sync = batch
commitlog_sync_batch_window_in_ms = 10
```

</details>

### Read Optimization

<details>
<summary>Click to view code (cql)</summary>

```cql
-- Use secondary indexes for filtering
CREATE INDEX idx_email ON users (email);

-- Projection: Select only needed columns
SELECT user_id, email FROM users WHERE user_id = ?;
-- Not: SELECT * FROM users WHERE user_id = ?;

-- Pagination
SELECT * FROM users WHERE user_id = ? LIMIT 100;
-- Fetch next page using last key

-- Caching
SELECT * FROM users WHERE user_id = ? USING CACHE;
```

</details>

### Hardware Configuration

<details>
<summary>Click to view code (properties)</summary>

```properties
# Memory allocation
-Xms8g -Xmx8g

# Data directory (fast SSD)
data_file_directories: ["/mnt/data/cassandra"]
commitlog_directory: "/mnt/commitlog"

# Network tuning
max_hints_window_in_ms: 10800000
seed_provider:
  - class_name: org.apache.cassandra.locator.SimpleSeedProvider
    parameters:
      - seeds: "192.168.1.1,192.168.1.2"

# Concurrency
concurrent_reads: 32
concurrent_writes: 32
```

</details>

---

## Scalability & High Availability

### Cluster Sizing

**Small cluster** (3-5 nodes):
<details>
<summary>Click to view code</summary>

```
Handles: 100K-1M ops/sec
Per node: SSD 500GB, 16GB RAM
Use case: Development, testing
```

</details>

**Medium cluster** (6-20 nodes):
<details>
<summary>Click to view code</summary>

```
Handles: 1M-10M ops/sec
Per node: SSD 2TB, 32GB RAM
Use case: Production, single DC
```

</details>

**Large cluster** (20+ nodes):
<details>
<summary>Click to view code</summary>

```
Handles: 10M+ ops/sec
Per node: SSD 4TB+, 64GB RAM
Use case: High-scale, multi-DC
```

</details>

### High Availability Strategy

<details>
<summary>Click to view code</summary>

```
Single node failure:
  ✓ No impact (RF=3 has 2 other replicas)
  ✓ Automatic failover (read from other replicas)
  
Multiple node failure:
  ✓ Still operational (if RF > number of failures)
  ✗ Reduced throughput (fewer replicas)
  ✗ Possible data loss (if failures > RF-1)

Entire DC failure:
  ✓ Application fails over to other DC
  ✓ Data preserved (multi-DC replication)
  ✗ Possible write losses (async replication)
```

</details>

### Repair Mechanism

<details>
<summary>Click to view code</summary>

```
Repair ensures replicas are consistent:

Command:
  nodetool repair -pr user_keyspace

Process:
  1. Merkle tree of local node
  2. Compare with replica nodes
  3. Stream missing/stale data
  4. Replicas become consistent

Schedule:
  Weekly or after RF-1 nodes fail
  Run during low-traffic window
```

</details>

---

## Use Cases

### 1. Time-Series Data (Metrics, Logs)

<details>
<summary>Click to view code (cql)</summary>

```cql
CREATE TABLE metrics (
  metric_name TEXT,
  timestamp TIMESTAMP,
  host TEXT,
  value FLOAT,
  PRIMARY KEY ((metric_name, host), timestamp)
);

-- Insert millions/sec
INSERT INTO metrics VALUES ('cpu', now(), 'server1', 85.5);

-- Range query (efficient with clustering)
SELECT * FROM metrics 
WHERE metric_name = 'cpu' 
  AND host = 'server1'
  AND timestamp >= ? AND timestamp < ?;
```

</details>

### 2. User Profiles & Activity

<details>
<summary>Click to view code (cql)</summary>

```cql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email TEXT,
  name TEXT,
  bio TEXT
);

CREATE TABLE user_activity (
  user_id UUID,
  timestamp TIMESTAMP,
  action TEXT,
  PRIMARY KEY (user_id, timestamp)
);

-- Fast user lookup + activity range query
SELECT * FROM users WHERE user_id = ?;
SELECT * FROM user_activity 
WHERE user_id = ? AND timestamp >= ? AND timestamp < ?;
```

</details>

### 3. Message Queue (Kafka-like)

<details>
<summary>Click to view code (cql)</summary>

```cql
CREATE TABLE messages (
  topic TEXT,
  partition INT,
  offset BIGINT,
  timestamp TIMESTAMP,
  payload BLOB,
  PRIMARY KEY ((topic, partition), offset)
);

-- Write millions/sec (high throughput)
INSERT INTO messages VALUES ('events', 0, 1000, now(), payload);

-- Consumer reads offset range
SELECT * FROM messages 
WHERE topic = 'events' AND partition = 0 
  AND offset >= ? AND offset <= ?
LIMIT 1000;
```

</details>

### 4. Real-time Analytics

<details>
<summary>Click to view code (cql)</summary>

```cql
CREATE TABLE events (
  event_type TEXT,
  day TEXT,
  hour TEXT,
  timestamp TIMESTAMP,
  user_id UUID,
  data MAP<TEXT, TEXT>,
  PRIMARY KEY ((event_type, day, hour), timestamp)
);

-- Aggregate within partition (efficient)
SELECT COUNT(*), AVG(price) FROM events
WHERE event_type = 'purchase' AND day = '2024-01-05'
GROUP BY hour;
```

</details>

---

## Interview Questions & Answers

### Q1: Design a real-time analytics system for 1M events/sec

**Requirements:**
- Ingest 1M events/sec
- Aggregate by event type, time windows (hourly, daily)
- Query: "Count purchases in last hour"
- 99.99% uptime

**Solution:**

<details>
<summary>Click to view code (cql)</summary>

```cql
CREATE KEYSPACE analytics 
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'us-east': 3,
  'eu-west': 2
};

-- Time-series partitioning (efficient range queries)
CREATE TABLE events (
  event_type TEXT,
  bucket TEXT,           -- Partition by hour (2024-01-05-10)
  timestamp TIMESTAMP,
  event_id UUID,
  user_id UUID,
  data TEXT,
  PRIMARY KEY ((event_type, bucket), timestamp, event_id)
);

-- Aggregation table (pre-computed)
CREATE TABLE event_counts (
  event_type TEXT,
  bucket_hour TEXT,      -- Hour bucket
  count_value BIGINT,
  PRIMARY KEY (event_type, bucket_hour)
);
```

</details>

**Write path:**

<details>
<summary>Click to view code (python)</summary>

```python
# High-throughput insert
from cassandra.cluster import Cluster
from datetime import datetime
from uuid import uuid4

cluster = Cluster(['node1', 'node2', 'node3'])
session = cluster.connect('analytics')

# Batch writes for throughput
prepared = session.prepare('''
  INSERT INTO events (
    event_type, bucket, timestamp, event_id, user_id, data
  ) VALUES (?, ?, ?, ?, ?, ?)
''')

for event in events_stream:
  bucket = event['timestamp'].strftime('%Y-%m-%d-%H')
  session.execute(prepared, [
    event['type'],
    bucket,
    event['timestamp'],
    uuid4(),
    event['user_id'],
    event['data']
  ], consistency_level=ConsistencyLevel.QUORUM)
```

</details>

**Read path (queries):**

<details>
<summary>Click to view code (cql)</summary>

```cql
-- Count events in last hour
SELECT COUNT(*) FROM events
WHERE event_type = 'purchase'
  AND bucket = '2024-01-05-10'
  AND timestamp >= ? AND timestamp < ?;

-- Top products (via aggregation)
SELECT product_id, COUNT(*) as count
FROM events
WHERE event_type = 'view' AND bucket = '2024-01-05-10'
GROUP BY product_id
LIMIT 10;
```

</details>

**Cluster setup:**

<details>
<summary>Click to view code</summary>

```
3 nodes per DC × 2 DCs = 6 nodes
Per node: 
  - 4 CPU
  - 32GB RAM
  - 2TB SSD (write-optimized)
  
Throughput: 1M events/sec ÷ 6 nodes = 167K/sec per node
(Cassandra handles 100K+/sec per node)
```

</details>

---

### Q2: Node fails. How to recover without data loss?

**Answer:**

**Failure scenarios with RF=3:**

<details>
<summary>Click to view code</summary>

```
Scenario 1: 1 node fails
  ✓ No impact (2 replicas still have data)
  ✓ Automatic failover (read from other replicas)
  ✓ No data loss
  
Scenario 2: 2 nodes fail simultaneously
  ⚠️ Depends on replication placement
  - If failures are on different DC: OK
  - If failures are on same DC: Possible data loss
  
Scenario 3: Node recovers after being down
  1. Node rejoins cluster
  2. Detects lag (missing writes while down)
  3. Repair fills in missing data
```

</details>

**Recovery process:**

<details>
<summary>Click to view code (bash)</summary>

```bash
# 1. Node comes back online
# Cassandra detects missed writes (hints)

# 2. Run repair (forces consistency)
nodetool repair -pr user_keyspace

# 3. Monitor repair progress
nodetool netstats

# 4. Verify data consistency
nodetool ring
```

</details>

**Hint system** (prevents write loss):

<details>
<summary>Click to view code</summary>

```
Write to A, B (C is down):
  A: success
  B: success
  C: (down, store hint locally)

When C recovers:
  Hints replay → C catches up with missed writes
  
Trade-off:
  - Hints stored locally on coordinator
  - If coordinator fails before replay → loss possible
  - Mitigation: Enable hint window (replay within N hours)
```

</details>

**Key takeaway**: "With RF=3, lose 1 node = no impact. Lose 2+ nodes = possible data loss. Always run `nodetool repair` weekly."

---

### Q3: Strong consistency requirement (financial transactions). How to achieve?

**Answer:**

**Challenge**: Cassandra is eventually consistent by default

**Solution: Hybrid consistency**

<details>
<summary>Click to view code (cql)</summary>

```cql
-- Use QUORUM consistency on writes
INSERT INTO accounts (account_id, balance) VALUES (?, ?)
USING CONSISTENCY QUORUM;

-- Use QUORUM consistency on reads
SELECT balance FROM accounts 
WHERE account_id = ?
USING CONSISTENCY QUORUM;

-- With RF=3:
--   QUORUM = 2 nodes
--   Write to 2 nodes + read from 2 nodes = strong consistency
```

</details>

**Trade-offs:**

<details>
<summary>Click to view code</summary>

```
QUORUM consistency:
  ✓ Strong consistency (within same node set)
  ✓ Withstand 1 node failure (RF=3)
  ✗ Slower than ONE (need to reach 2 nodes)
  ✗ Fails if 2+ nodes down (can't get quorum)

Availability impact:
  ONE: Always available (unless all replicas down)
  QUORUM: Available if > RF/2 replicas up
    RF=3, need 2 alive: Can lose 1 node
    RF=5, need 3 alive: Can lose 2 nodes
```

</details>

**Read-before-write pattern:**

<details>
<summary>Click to view code (cql)</summary>

```cql
-- For balance updates (prevent race conditions)
SELECT balance FROM accounts 
WHERE account_id = ? 
USING CONSISTENCY QUORUM;

-- Compute new balance
new_balance = balance - withdrawal;

-- Update with conditional write (lightweight transaction)
UPDATE accounts SET balance = ?
WHERE account_id = ?
IF balance = ?;  -- Only update if balance unchanged
```

</details>

**Lightweight transactions (LWT):**

<details>
<summary>Click to view code (cql)</summary>

```cql
-- Atomic compare-and-set
UPDATE accounts SET balance = 950
WHERE account_id = 'user1'
IF balance = 1000;  -- Conditional

// Under the hood:
// 1. Read current balance from QUORUM (consensus)
// 2. If matches condition, write to QUORUM
// 3. Atomic within cluster
```

</details>

**Key takeaway**: "Use QUORUM consistency + lightweight transactions for strong consistency guarantees, but accept higher latency."

---

### Q4: Query latency spike. How to diagnose?

**Answer:**

**Diagnosis checklist:**

<details>
<summary>Click to view code (bash)</summary>

```bash
# 1. Check cluster health
nodetool status

# 2. Check node load
nodetool info

# 3. Monitor GC pauses
nodetool gcstats

# 4. Check compaction queue
nodetool compactionstats

# 5. Monitor disk I/O
iostat -x 1

# 6. Check slow queries (enable query logging)
nodetool settraceprobability 1.0

# 7. Analyze trace
SELECT * FROM system_traces.sessions 
WHERE session_id = ?;
```

</details>

**Common causes and solutions:**

| Problem | Cause | Fix |
|---------|-------|-----|
| **High read latency** | Bloom filter miss (SSTable scan) | Reduce number of SSTables (compact) |
| **High write latency** | Too many SSTables | Run compaction |
| **GC pauses** | Large heap allocations | Reduce batch size, increase heap |
| **Disk I/O bottleneck** | Random reads from disk | Ensure hot data in cache |
| **Unbalanced cluster** | Uneven token distribution | Rebalance tokens |
| **Hot partition** | Single key receiving all traffic | Use partition sharding (add dimension) |

**Hot partition mitigation:**

<details>
<summary>Click to view code</summary>

```
Problem: User 'celebrity' has 1M followers
         Everyone writes to their followers_list partition
         
Before (hot):
  CREATE TABLE followers (
    user_id UUID PRIMARY KEY,
    follower_id UUID,
    PRIMARY KEY (user_id, follower_id)
  );
  // All writes go to celebrity's partition (bottleneck)

After (sharded):
  CREATE TABLE followers (
    user_id UUID,
    shard_id INT,
    follower_id UUID,
    PRIMARY KEY ((user_id, shard_id), follower_id)
  );
  // Distribute across 10 shards (10x improvement)
  
  INSERT INTO followers VALUES (celebrity, shard_id=0, user1);
  INSERT INTO followers VALUES (celebrity, shard_id=1, user2);
  // Writes distribute across 10 partitions
```

</details>

---

### Q5: Design a distributed cache (like Redis) with Cassandra durability

**Answer:**

**Architecture:**

<details>
<summary>Click to view code</summary>

```
Cache layer + Cassandra durability:
  - Memcached/Redis layer (fast, in-memory)
  - Cassandra layer (durable, persistent)
  
Write flow:
  Client → Memcached (confirm) → Write to Cassandra (background)

Read flow:
  Client → Memcached (cache hit, fast) 
        → Cassandra (cache miss, slower)
        → Memcached (populate cache)
```

</details>

**Implementation:**

<details>
<summary>Click to view code (cql)</summary>

```cql
CREATE TABLE cache (
  cache_key TEXT PRIMARY KEY,
  value BLOB,
  ttl INT,
  created_at TIMESTAMP
);

-- Insert with TTL (auto-delete after expiry)
INSERT INTO cache (cache_key, value, created_at) 
VALUES (?, ?, now())
USING TTL 3600;  // Auto-delete after 1 hour

-- Read with consistency ONE (fast, from cache)
SELECT value FROM cache 
WHERE cache_key = ?
USING CONSISTENCY ONE;
```

</details>

**Cache invalidation strategy:**

<details>
<summary>Click to view code (python)</summary>

```python
# Write-through cache
def get_user(user_id):
    # Check Memcached first
    cached = memcached.get(f"user:{user_id}")
    if cached:
        return cached
    
    # Cache miss, read from Cassandra
    user = cassandra.select("user_id = ?", user_id)
    
    # Populate cache
    memcached.set(f"user:{user_id}", user, ttl=1hour)
    return user

def update_user(user_id, data):
    # Update Cassandra
    cassandra.update("user_id = ?", user_id, data)
    
    # Invalidate cache
    memcached.delete(f"user:{user_id}")
```

</details>

**Durability guarantees:**

<details>
<summary>Click to view code</summary>

```
Write QUORUM + async Cassandra write:
  1. Write to Memcached (in-memory, fast)
  2. Write to Cassandra QUORUM (durable)
  3. Memcached loss ≠ data loss (Cassandra has it)
  
If Memcached fails:
  Cassandra still has data
  Repopulate Memcached on read (cache miss)
```

</details>

---

## Cassandra vs Alternatives

| System | Throughput | Latency | Best For | Trade-off |
|--------|-----------|---------|----------|-----------|
| **Cassandra** | 1M+/sec | 5-20ms | High-write, distributed | Eventual consistency |
| **DynamoDB** | 100K+/sec | 5-10ms | Managed, serverless | AWS vendor lock-in |
| **HBase** | 100K+/sec | 10-50ms | Hadoop ecosystem | Operational complexity |
| **MongoDB** | 100K+/sec | 5-20ms | Document flexibility | ACID trade-offs |
| **Redis** | 1M+/sec | 1-5ms | In-memory cache | No persistence (custom) |

---

## Best Practices

### Data Modeling

✓ **Denormalize** (opposite of relational databases)
✓ **Design tables around queries** (not entities)
✓ **Avoid hot partitions** (use sharding if needed)
✓ **Keep partition size < 100MB** (optimal SSTable size)
✓ **Use composite keys** (partition key + clustering key)
✓ **Plan for time-series** (bucket by hour/day)

### Operational Best Practices

✓ **Always use RF ≥ 3** (production minimum)
✓ **Monitor compaction** (queue shouldn't grow unbounded)
✓ **Run repairs weekly** (prevents data divergence)
✓ **Monitor GC pauses** (tune heap if > 100ms)
✓ **Use local_quorum** for multi-DC (reduce latency)
✓ **Plan capacity** (monitor disk growth)
✓ **Enable client-side caching** (reduce read load)

### Query Optimization

✓ **Partition key must be in WHERE clause** (required)
✓ **Use clustering key for range queries** (efficient)
✓ **Avoid large result sets** (use LIMIT)
✓ **Batch writes** (higher throughput)
✓ **Use prepared statements** (prevent re-parsing)
✓ **Fetch only needed columns** (reduce network I/O)

---

## Disaster Recovery Strategy

### Single-Datacenter Failure

| Failure Mode | RF=3 | Impact | Recovery |
|--------------|------|--------|----------|
| 1 node down | ✓ Safe | No impact | Auto (replicas serve) |
| 2 nodes down | ⚠️ Risky | Partial data loss possible | Repair after recovery |
| 3+ nodes down | ✗ Loss | Complete data loss | Restore from backup |

### Multi-Datacenter Failover

<details>
<summary>Click to view code</summary>

```
Primary DC (US-East): 3 nodes, RF=3
Secondary DC (EU-West): 2 nodes

Failure: Entire US-East goes down
  - EU still has RF=2 replicas
  - All data preserved
  - Failover time: seconds (client retries)
  - Trade-off: Possible data loss if RF < DC failures
  
Solution: Use RF=5, distribute replicas
  US-East: 3 replicas
  EU-West: 2 replicas
  → Lose entire DC, data survives
```

</details>

### Backup and Recovery

<details>
<summary>Click to view code (bash)</summary>

```bash
# Snapshot (consistent backup)
nodetool snapshot user_keyspace

# Upload to S3
tar -czf snapshot.tar.gz /var/lib/cassandra/snapshots/
aws s3 cp snapshot.tar.gz s3://cassandra-backups/

# Restore from snapshot
# 1. Restore SSTables to node
# 2. Run repair to sync
nodetool repair -pr user_keyspace
```

</details>

---

## Summary & Key Takeaways

**Cassandra excels at:**
- ✓ High write throughput (1M+ writes/sec)
- ✓ Linear scalability (add nodes, increase capacity)
- ✓ High availability (distributed, no single point of failure)
- ✓ Multi-datacenter support (native geo-replication)
- ✓ Time-series data (efficient range queries)

**Key challenges:**
- ✗ Eventual consistency (not strong by default)
- ✗ Operational complexity (cluster management, repairs)
- ✗ Query flexibility (must design tables per query)
- ✗ Learning curve (CQL, data modeling, tuning)
- ✗ No transactions (no ACID, eventual consistency)

**Critical design questions:**
1. What's my write throughput requirement (ops/sec)?
2. Do I need strong consistency or eventual is OK?
3. How long must I retain data?
4. What's my acceptable data loss (RPO)?
5. Do I need multi-datacenter replication?
6. What queries must I support (design tables)?
7. Can I handle operational complexity?

---

## Cassandra — Practical Guide & Deep Dive

Apache Cassandra is an open-source, distributed NoSQL database originally built by Facebook for inbox search. It implements a partitioned **wide-column** storage model with **eventually consistent** semantics. Cassandra combines elements of **Dynamo** (partitioning, replication) and **Bigtable** (column-oriented storage) to handle massive data footprints, query volume, and flexible storage requirements.

Used by Discord, Netflix, Apple, and Bloomberg — Cassandra is here to stay.

---

### Cassandra Basics

#### Data Model

| Concept | Description |
|---|---|
| **Keyspace** | Top-level unit (like a "database"). Defines replication strategies and owns UDTs |
| **Table** | Lives within a keyspace. Organizes data into rows with a defined schema |
| **Row** | Single record identified by a primary key |
| **Column** | Data storage unit with name, type, value, and timestamp metadata. Columns can vary per row (wide-column) |

At a basic level, Cassandra's data looks like nested JSON:

```json
{
  "keyspace1": {
    "table1": {
      "row1": { "col1": 1, "col2": "2" },
      "row2": { "col1": 10, "col3": 3.0 },
      "row3": { "col4": { "company": "Hello Interview", "city": "Seattle" } }
    }
  }
}
```

> **Wide-column flexibility:** Unlike relational databases that require an entry for every column per row (even NULL), Cassandra allows columns to vary per row.

> **Conflict resolution:** Every column has a timestamp. Write conflicts between replicas are resolved via **"last write wins"**.

#### Primary Key

Every row is uniquely identified by a **primary key** consisting of:

| Component | Purpose |
|---|---|
| **Partition Key** | One or more columns determining which partition stores the row |
| **Clustering Key** | Zero or more columns determining sorted order within a partition |

```sql
-- Partition key: a, no clustering keys
CREATE TABLE t (a text, b text, c text, PRIMARY KEY (a));

-- Partition key: a, clustering key: b ascending
CREATE TABLE t (a text, b text, c text, PRIMARY KEY ((a), b))
WITH CLUSTERING ORDER BY (b ASC);

-- Composite partition key: a+b, clustering key: c
CREATE TABLE t (a text, b text, c text, d text, PRIMARY KEY ((a, b), c));

-- Partition key: a, clustering keys: b+c
CREATE TABLE t (a text, b text, c text, d text, PRIMARY KEY ((a), b, c));
```

---

### Key Concepts

#### Partitioning — Consistent Hashing

Cassandra achieves horizontal scalability by partitioning data across nodes using **consistent hashing**.

**Traditional hashing problem:** `hash(value) % num_nodes` causes massive data remapping when nodes are added/removed, and can produce uneven distribution.

**Consistent hashing solution:**
- Values are hashed to positions on a **ring** of integers
- Walking clockwise from the hash position finds the first node → that node stores the data
- Adding/removing a node only affects the adjacent node's data

**Virtual nodes (vnodes):** To address uneven load, Cassandra maps multiple **virtual nodes** on the ring to physical nodes. Benefits:
- More even distribution across the cluster
- Larger physical machines can own more vnodes
- Adding a node redistributes load from many existing nodes (not just one)

#### Replication

Keyspaces specify replication configuration. Cassandra replicates by scanning clockwise from the assigned vnode to find additional replica nodes (skipping vnodes on the same physical node).

| Strategy | Description |
|---|---|
| **SimpleStrategy** | Scans clockwise for replicas. Good for testing/simple deployments |
| **NetworkTopologyStrategy** | Data-center and rack aware. Recommended for production. Ensures replicas span physical failure domains |

```sql
-- SimpleStrategy: 3 replicas
ALTER KEYSPACE hello_interview
WITH REPLICATION = { 'class': 'SimpleStrategy', 'replication_factor': 3 };

-- NetworkTopologyStrategy: 3 replicas in dc1, 2 in dc2
ALTER KEYSPACE hello_interview
WITH REPLICATION = { 'class': 'NetworkTopologyStrategy', 'dc1': 3, 'dc2': 2 };
```

#### Consistency

Cassandra gives users flexibility over consistency levels for reads and writes — a tunable **consistency vs. availability trade-off**.

> **No ACID guarantees.** Cassandra only supports atomic and isolated writes at the row level within a partition.

| Consistency Level | Behavior |
|---|---|
| **ONE** | Single replica must respond |
| **QUORUM** | Majority (n/2 + 1) of replicas must respond |
| **ALL** | All replicas must respond |

**QUORUM on both reads and writes** guarantees that writes are visible to reads because at least one overlapping node participates in both operations. With 3 replicas: `3/2 + 1 = 2` nodes must participate in each operation.

Cassandra aims for **eventual consistency** — all replicas converge to the latest data given enough time.

#### Query Routing

**Any node can be a coordinator.** Cassandra nodes know about other alive nodes via **gossip protocol**. When a client issues a query:

1. Client selects a node → it becomes the coordinator
2. Coordinator determines which nodes store the data (consistent hashing + replication strategy)
3. Coordinator issues queries to relevant replica nodes
4. Responses are returned to the client

#### Storage Model — LSM Tree

Cassandra uses a **Log Structured Merge Tree (LSM tree)** instead of a B-tree, favoring **write speed over read speed**.

**Key insight:** Every create/update/delete is a new entry. Cassandra uses ordering of entries to determine row state. Deletes write a **tombstone** marker.

**Three core constructs:**

| Construct | Description |
|---|---|
| **Commit Log** | Write-ahead log for durability |
| **Memtable** | In-memory sorted structure (sorted by primary key) |
| **SSTable** | Immutable on-disk file flushed from Memtable |

**Write path:**
1. Write is issued to a node
2. Written to **commit log** (durability guarantee)
3. Written to **Memtable** (in-memory)
4. When Memtable reaches threshold → flushed to disk as immutable **SSTable**
5. Corresponding commit log entries are removed

**Read path:**
1. Check **Memtable** first (latest data)
2. If not found, use **bloom filter** to identify candidate SSTables
3. Read SSTables newest-to-oldest to find latest data (sorted by primary key)

**Compaction:** Periodically merges SSTables to consolidate updates and remove tombstones, keeping read performance healthy.

**SSTable Indexing:** Files mapping keys to byte offsets in SSTables for fast on-disk retrieval.

#### Gossip Protocol

Cassandra nodes communicate cluster information via **peer-to-peer gossip**:
- Nodes track generation (bootstrap timestamp) and version (logical clock) for each known node
- These form a **vector clock** — nodes ignore stale state information
- **Seed nodes** act as guaranteed gossip hotspots, preventing cluster fragmentation
- Every node being aware of the cluster eliminates single points of failure

#### Fault Tolerance

**Failure detection:** **Phi Accrual Failure Detector** — each node independently decides if another node is available. Nodes aren't considered truly "down" unless an admin decommissions them.

**Hinted handoffs:** When a coordinator can't reach a replica node:
1. Coordinator temporarily stores the write data as a **hint**
2. Write proceeds successfully
3. When the offline node comes back, hints are forwarded to it

> Hinted handoffs are short-term. Long-offline nodes require **read repairs** or rebuilds.

---

### Data Modeling for Cassandra

Cassandra data modeling is **query-driven** (not entity-relationship-driven like relational DBs).

**Key principles:**
- No JOINs, no foreign keys, no referential integrity
- Design tables around **access patterns** first
- **Denormalize** data across tables as needed
- Consider: partition key choice, partition size limits, clustering key ordering

#### Example: Discord Messages

Discord uses Cassandra for message storage. Access pattern: users query recent messages for a channel.

**First iteration:**

```sql
CREATE TABLE messages (
  channel_id bigint,
  message_id bigint,
  author_id bigint,
  content text,
  PRIMARY KEY (channel_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
```

- **Partition key:** `channel_id` → single partition per channel, efficient reads
- **Clustering key:** `message_id` DESC → reverse chronological order
- Uses **Snowflake IDs** (chronologically sortable UUIDs) instead of timestamps to avoid collisions

**Problem:** Busy channels create huge partitions → performance degradation. Partitions grow monotonically.

**Solution — Time bucketing:**

```sql
CREATE TABLE messages (
  channel_id bigint,
  bucket int,
  message_id bigint,
  author_id bigint,
  content text,
  PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
```

- `bucket` represents 10-day windows aligned to Discord's epoch
- Limits partition size even for busiest channels
- Most queries hit a single partition (latest bucket)
- New buckets created automatically as time progresses

#### Example: Ticketmaster Ticket Browsing

Access pattern: users view event venue sections, then drill into individual seats.

**First iteration (all seats per event):**

```sql
CREATE TABLE tickets (
  event_id bigint,
  seat_id bigint,
  price bigint,
  PRIMARY KEY (event_id, seat_id)
);
```

**Problem:** Events with 10k+ tickets → large partitions, expensive aggregations for section summaries.

**Better design — partition by section:**

```sql
CREATE TABLE tickets (
  event_id bigint,
  section_id bigint,
  seat_id bigint,
  price bigint,
  PRIMARY KEY ((event_id, section_id), seat_id)
);
```

**Denormalized summary table for venue overview:**

```sql
CREATE TABLE event_sections (
  event_id bigint,
  section_id bigint,
  num_tickets bigint,
  price_floor bigint,
  PRIMARY KEY (event_id, section_id)
);
```

- Venue overview → query `event_sections` (single partition, < 100 sections)
- Section detail → query `tickets` (single partition per section)
- Section stats don't need to be exact (Ticketmaster shows "100+" not exact counts)

---

### Advanced Features

| Feature | Description |
|---|---|
| **Storage Attached Indexes (SAI)** | Global secondary indexes on columns. Flexible querying with good (not optimal) performance. Avoids excess denormalization for infrequent queries |
| **Materialized Views** | Cassandra automatically materializes denormalized tables from a source table. Reduces application-level complexity for multi-table writes |
| **Search Indexing** | Wire up to Elasticsearch or Apache Solr via plugins (e.g., Stratio Lucene Index) |

---

### Cassandra in an Interview

**When to use:**
- Systems prioritizing **availability over consistency**
- **High write throughput** needs (LSM tree optimized writes)
- **High scalability** requirements (linear horizontal scaling)
- **Flexible/sparse schemas** (wide-column model)
- Clear, well-defined **access patterns** the schema can revolve around

**When NOT to use:**
- Strict consistency requirements (financial transactions, inventory)
- Complex query patterns (multi-table JOINs, ad-hoc aggregations)
- Small datasets that don't need distributed scaling
- Rapidly evolving query patterns (each new query may need a new table)

---

## Additional Interview Questions & Answers

### Q6: Explain consistent hashing and virtual nodes. Why does Cassandra use them?

**Answer:**

**Consistent hashing** maps both data and nodes onto a ring of integers. Data is stored on the first node encountered when walking clockwise from the data's hash position.

**Why not traditional hashing (`hash % num_nodes`)?**
- Adding/removing a node remaps ~all data (catastrophic in a distributed DB)
- Consistent hashing: adding/removing a node only affects adjacent nodes' data

**Virtual nodes (vnodes):**
- Each physical node owns multiple positions on the ring (default: 256 vnodes per node)
- Benefits:
  - **Even distribution** — more ring positions = more uniform data spread
  - **Heterogeneous hardware** — larger machines can own more vnodes
  - **Faster rebalancing** — adding a node takes small slices from many nodes instead of a large chunk from one
  - **Faster rebuilds** — data streams from many nodes in parallel

**Interview tip:** Consistent hashing is useful beyond Cassandra — apply it to cache distribution, load balancing, or any sharding problem.

---

### Q7: How does Cassandra's write path differ from a traditional relational database? Why is Cassandra faster for writes?

**Answer:**

| Aspect | Relational DB (B-tree) | Cassandra (LSM tree) |
|---|---|---|
| **Write pattern** | Random I/O (find and update in-place) | Sequential I/O (append to commit log + memtable) |
| **On-disk structure** | Mutable B-tree pages | Immutable SSTables |
| **Write amplification** | Low per write, but random seeks are slow | Higher (compaction), but writes themselves are fast |
| **Read performance** | Optimized (B-tree lookups) | Requires checking memtable + multiple SSTables |

**Why Cassandra is faster for writes:**
1. **Commit log** is append-only → sequential disk I/O (fastest possible disk operation)
2. **Memtable** is in-memory → no disk I/O for the actual data write
3. No need to read-before-write (no in-place updates)
4. SSTable flushes are sequential bulk writes
5. No locking or transaction overhead

**Tradeoff:** Reads may need to check multiple SSTables → bloom filters and compaction mitigate this.

---

### Q8: What are tombstones in Cassandra? Why can they be problematic?

**Answer:**

**Tombstones** are markers that Cassandra writes when data is deleted. Since SSTables are immutable, Cassandra can't remove data in-place — instead it writes a tombstone that says "this data is deleted."

**How they work:**
1. Delete issued → tombstone written to memtable → flushed to SSTable
2. During reads, tombstones override earlier versions of the data
3. During **compaction**, tombstoned data is permanently removed (after `gc_grace_seconds`, default 10 days)

**Why they're problematic:**
- **Read performance degradation** — reads must scan through tombstones before finding live data
- **Memory pressure** — tombstones consume memory during reads
- **"Tombstone storm"** — deleting many rows at once creates massive numbers of tombstones
- If `gc_grace_seconds` is too short, deleted data can **resurrect** via repair from a replica that missed the delete

**Best practices:**
- Avoid frequent deletes — use TTLs for time-expiring data instead
- Use appropriate compaction strategies (e.g., `TimeWindowCompactionStrategy` for time-series data with TTLs)
- Monitor tombstone counts per read (`TombstoneScannedHistogram`)
- Don't set `gc_grace_seconds` lower than your repair cycle

---

### Q9: How would you model a time-series IoT sensor system in Cassandra?

**Answer:**

**Requirements:** Millions of sensors, each reporting every few seconds. Query patterns: latest readings per sensor, readings in a time range.

**Schema:**

```sql
CREATE TABLE sensor_readings (
  sensor_id uuid,
  day date,
  reading_time timestamp,
  temperature double,
  humidity double,
  pressure double,
  PRIMARY KEY ((sensor_id, day), reading_time)
) WITH CLUSTERING ORDER BY (reading_time DESC)
  AND default_time_to_live = 2592000;  -- 30-day TTL
```

**Design decisions:**

| Decision | Reasoning |
|---|---|
| **Partition key: `(sensor_id, day)`** | Bounds partition size to one day per sensor; prevents unbounded growth |
| **Clustering key: `reading_time` DESC** | Latest readings returned first (most common query pattern) |
| **TTL: 30 days** | Auto-expiration avoids tombstone accumulation from manual deletes |
| **Compaction: `TimeWindowCompactionStrategy`** | Optimized for time-series data where entire windows expire together |

**Query examples:**

```sql
-- Latest readings for sensor today
SELECT * FROM sensor_readings
WHERE sensor_id = ? AND day = '2026-03-30'
LIMIT 10;

-- Readings in a time range
SELECT * FROM sensor_readings
WHERE sensor_id = ? AND day = '2026-03-30'
AND reading_time >= '2026-03-30 10:00:00'
AND reading_time <= '2026-03-30 12:00:00';
```

**Scaling:** With 1M sensors reporting every 5 seconds = 200k writes/sec. At ~100 bytes per reading, daily storage ≈ 1.7 TB. Cassandra handles this comfortably with a well-sized cluster (10-15 nodes).

---

### Q10: Compare Cassandra vs DynamoDB. When would you choose each?

**Answer:**

| Feature | Cassandra | DynamoDB |
|---|---|---|
| **Deployment** | Self-managed or managed (Astra DB) | Fully managed (AWS) |
| **Data model** | Wide-column (flexible schema) | Key-value + document |
| **Primary key** | Partition key + clustering key | Partition key + sort key |
| **Consistency** | Tunable (ONE to ALL) | Eventually consistent or strongly consistent |
| **Scaling** | Manual (add nodes, rebalance) | Automatic (on-demand or provisioned) |
| **Multi-region** | NetworkTopologyStrategy | Global Tables |
| **Secondary indexes** | SAI, materialized views | GSI, LSI |
| **Cost model** | Infrastructure + ops team | Pay-per-request or provisioned capacity |
| **Vendor lock-in** | None (open source) | AWS only |
| **Throughput** | Very high (you control hardware) | High (AWS manages limits) |

**Choose Cassandra when:**
- You need vendor independence
- You want full control over tuning and infrastructure
- Your team has operational expertise
- You need extreme write throughput with custom hardware

**Choose DynamoDB when:**
- You want zero operational overhead
- You're already in the AWS ecosystem
- You need automatic scaling without capacity planning
- Your team is small and can't dedicate resources to DB operations

---

### Q11: Explain Cassandra's gossip protocol. How does it prevent split-brain?

**Answer:**

**Gossip** is Cassandra's peer-to-peer protocol for sharing cluster state:

1. Every second, each node randomly selects 1-3 other nodes to gossip with
2. Nodes exchange **heartbeat state** — generation (bootstrap timestamp) + version (incrementing counter)
3. These form a **vector clock** — newer information supersedes older
4. Nodes probabilistically bias gossip toward **seed nodes**

**Why seed nodes matter:**
- Seed nodes are guaranteed gossip targets that prevent cluster fragmentation
- Without them, sub-clusters could form where groups of nodes only know about each other
- New nodes use seed nodes for initial cluster discovery

**Split-brain prevention:**
- Cassandra doesn't use leader election (no single point of failure)
- Every node can serve requests independently
- **Phi Accrual Failure Detector** provides probabilistic failure detection (not binary up/down)
- Nodes don't make irreversible decisions about cluster membership — a "convicted" node simply re-enters the cluster when it starts heartbeating again
- **Hinted handoffs** ensure writes aren't lost during temporary network partitions

**Key difference from consensus-based systems (Raft/Paxos):** Cassandra favors availability — it doesn't require quorum agreement for cluster membership changes. This makes it more resilient to network partitions but means it relies on eventual consistency.

---

### Q12: How would you handle a "hot partition" in Cassandra?

**Answer:**

**Hot partition:** A single partition receives disproportionate read/write traffic, overloading the node(s) hosting it.

**Detection:**
- Monitor `org.apache.cassandra.metrics:type=Table` metrics per table
- Look for uneven load across nodes (`nodetool tablehistograms`)
- Client-side latency spikes for specific partition keys

**Solutions:**

| Strategy | How It Works | Tradeoff |
|---|---|---|
| **Add bucketing to partition key** | Split `(user_id)` into `(user_id, bucket)` where bucket = `hash(timestamp) % N` | Reads must query N buckets and merge |
| **Application-level caching** | Cache hot partition data in Redis/Memcached | Added infrastructure, cache invalidation complexity |
| **Scatter-gather with salt** | Add random salt to partition key, fan-out reads | Higher read latency, more complex application logic |
| **Redesign data model** | Re-examine access patterns; maybe the partition key choice is wrong | May require migration |
| **Rate limiting** | Throttle writes/reads to hot keys at application layer | May degrade user experience |

**Prevention (at design time):**
- Avoid low-cardinality partition keys (e.g., `country` for a global app)
- Estimate max partition size and access frequency during data modeling
- Use compound partition keys to distribute load (like Discord's `(channel_id, bucket)`)

---

### Q13: What compaction strategies does Cassandra offer and when should you use each?

**Answer:**

| Strategy | Best For | How It Works |
|---|---|---|
| **SizeTieredCompactionStrategy (STCS)** | Write-heavy workloads | Merges similarly-sized SSTables. Simple but can cause temporary space amplification (needs 2x disk) |
| **LeveledCompactionStrategy (LCS)** | Read-heavy workloads | Organizes SSTables into levels of increasing size. Guarantees at most 1 SSTable per partition per level. Better read performance, higher write amplification |
| **TimeWindowCompactionStrategy (TWCS)** | Time-series data with TTL | Groups SSTables by time window. Entire windows drop when all data expires. Very efficient for TTL-based expiration |
| **UnifiedCompactionStrategy (UCS)** | General purpose (Cassandra 5.0+) | Adaptive strategy that combines benefits of STCS and LCS based on workload characteristics |

**Decision guide:**

```
Write-heavy, rarely read → STCS
Read-heavy, frequent updates → LCS
Time-series with TTL → TWCS
Not sure / mixed workload → UCS (if available)
```

**Interview tip:** Mentioning compaction strategy shows deep understanding. The key insight is that compaction is the price Cassandra pays for fast writes — it defers the "cleanup" work to background processes.

---

### Q14: How does Cassandra compare to MongoDB for a system design interview?

**Answer:**

| Feature | Cassandra | MongoDB |
|---|---|---|
| **Data model** | Wide-column (rows with varying columns) | Document (JSON/BSON) |
| **Query language** | CQL (SQL-like, limited) | MQL (rich query language, aggregation pipeline) |
| **Schema** | Defined per table (flexible columns) | Schema-less (flexible documents) |
| **Consistency** | Tunable (eventual by default) | Strong by default (single-document ACID) |
| **Scaling** | Peer-to-peer (no single point of failure) | Primary-secondary (primary handles writes) |
| **Write performance** | Excellent (LSM tree, sequential I/O) | Good (WiredTiger B-tree) |
| **JOINs** | Not supported | Not native (use `$lookup` for basic joins) |
| **Secondary indexes** | SAI (limited) | Rich secondary indexes |
| **Multi-region** | Native (NetworkTopologyStrategy) | Atlas Global Clusters |

**Choose Cassandra when:**
- Availability > consistency
- Extreme write throughput
- Well-defined, predictable access patterns
- Multi-datacenter replication is critical

**Choose MongoDB when:**
- Flexible/evolving query patterns
- Rich querying and aggregation needed
- Single-document transactions suffice
- Developer productivity is a priority (richer query language)

---

### Q15: Design a Cassandra schema for a social media feed (like Twitter/X timeline).

**Answer:**

**Access patterns:**
1. View a user's own posts (profile page)
2. View a user's home timeline (posts from people they follow)
3. Post a new message

**Schema:**

```sql
-- User's own posts (profile view)
CREATE TABLE user_posts (
  user_id bigint,
  post_id bigint,        -- Snowflake ID (chronologically sortable)
  content text,
  media_urls list<text>,
  like_count counter,     -- Separate counter table in practice
  PRIMARY KEY (user_id, post_id)
) WITH CLUSTERING ORDER BY (post_id DESC);

-- Home timeline (fan-out on write)
CREATE TABLE home_timeline (
  user_id bigint,
  post_id bigint,
  author_id bigint,
  content text,
  author_name text,       -- Denormalized for read efficiency
  PRIMARY KEY (user_id, post_id)
) WITH CLUSTERING ORDER BY (post_id DESC);
```

**Fan-out on write strategy:**
1. User posts a message → write to `user_posts`
2. Look up all followers of the user
3. For each follower, write a copy to their `home_timeline`

**Design considerations:**

| Concern | Solution |
|---|---|
| **Celebrity fan-out** | Hybrid approach — fan-out on write for normal users, fan-out on read for celebrities (> 1M followers) |
| **Partition size** | Use TTL or bucketing `(user_id, bucket)` to prevent unbounded timeline growth |
| **Stale denormalized data** | Author name changes are infrequent; eventual consistency is acceptable |
| **Timeline truncation** | Only keep latest 1000 posts per timeline; older posts fetched on-demand |

**Query:**

```sql
-- Home timeline (latest 20 posts)
SELECT * FROM home_timeline
WHERE user_id = ?
LIMIT 20;

-- Pagination via search_after
SELECT * FROM home_timeline
WHERE user_id = ? AND post_id < ?
LIMIT 20;
```

