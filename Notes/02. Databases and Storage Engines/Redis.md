# Redis for System Design

System designs can involve a dizzying array of different technologies, concepts and patterns, but one technology (arguably) stands above the rest in terms of its versatility: **Redis**. This versatility is important in an interview setting because it allows you to go deep. Instead of learning about dozens of different technologies, you can learn a few useful ones and learn them deeply, which magnifies the chances that you're able to get to the level your interviewer is expecting.

Beyond versatility, Redis is great for its **simplicity**. Redis has a ton of features which resemble data structures you're probably used to from coding (hashes, sets, sorted sets, streams, etc) and which, given a few basics, are easy to reason about how they behave in a distributed system. While many databases involve a lot of magic (optimizers, query planners, etc), with only minor exceptions Redis has remained quite simple and good at what it does best: executing simple operations fast.

---

## Redis Basics

Redis is a self-described **"data structure store"** written in C. It's **in-memory** and **single threaded**, making it very fast and easy to reason about.

> **Durability caveat:** One important reason you might not want to use Redis is because you need durability. While there are some reasonable strategies (using Redis' **Append-Only File / AOF**) to minimize data loss, you don't get the same guarantees you might get from e.g. a relational database about commits being written to disk. This is an intentional tradeoff made by the Redis team in favor of speed, but alternative implementations (e.g. AWS' **MemoryDB**) will compromise a bit on speed to give you disk-based durability.

### Fundamental Data Structures

| Data Structure | Description |
|---|---|
| **Strings** | Simple key-value pairs |
| **Hashes** | Objects / dictionaries |
| **Lists** | Ordered collections |
| **Sets** | Unordered unique collections |
| **Sorted Sets** | Priority queues (ordered by score) |
| **Bloom Filters** | Probabilistic set membership; allows false positives |
| **Geospatial Indexes** | Longitude/latitude based indexing |
| **Time Series** | Time-stamped data points |

In addition to simple data structures, Redis also supports different communication patterns like **Pub/Sub** and **Streams**, partially standing in for more complex setups like Apache Kafka or AWS SNS / SQS.

### Key-Value Model

The core structure underneath Redis is a **key-value store**. Keys are strings while values can be any of the data structures supported by Redis: binary data and strings, sets, lists, hashes, sorted sets, etc. All objects in Redis have a key.

The choice of keys is important as these keys might be stored in separate nodes based on your infrastructure configuration. Effectively, **the way you organize the keys will be the way you organize your data and scale your Redis cluster**.

---

## Commands

Redis' wire protocol is a custom query language comprised of simple strings which are used for all functionality of Redis. The CLI is really simple — you can literally connect to a Redis instance and run these commands from the CLI.

```bash
SET foo 1
GET foo       # Returns 1
INCR foo      # Returns 2
XADD mystream * name Sara surname OConnor  # Adds an item to a stream
```

The full set of commands is surprisingly readable when grouped by data structure. For example, Redis' **Sets** support:

| Command | Description |
|---|---|
| `SADD` | Add an element to the set |
| `SCARD` | Get the cardinality (count of members) |
| `SMEMBERS` | List all elements |
| `SISMEMBER` | Check if an element exists |

---

## Infrastructure Configurations

Redis can run as:

1. **Single node**
2. **High availability (HA) replica**
3. **Cluster**

When operating as a cluster, Redis clients cache a set of **"hash slots"** which map keys to a specific node. This way clients can directly connect to the node which contains the data they are requesting.

> Think of hash slots like a phone book: the client keeps a local map from slots to nodes. If a slot moves during rebalancing or failover, the server replies with `MOVED` and the client refreshes its map (e.g. via `CLUSTER SHARDS`).

Each node maintains some awareness of other nodes via a **gossip protocol** so, in limited instances, if you request a key from the wrong node you can be redirected to the correct node. But Redis' emphasis is on performance so hitting the correct endpoint first is a priority.

> **Important:** With few exceptions, Redis expects all the data for a given request to be on a single node! Choosing how to structure your keys is how you scale Redis.

---

## Performance

Redis is **really, really fast**. Redis can handle **O(100k) writes per second** and read latency is often in the **microsecond range**.

This scale makes some anti-patterns for other database systems actually feasible with Redis. For example, firing off 100 SQL requests to generate a list of items with a SQL database is a terrible idea — you're better off writing a SQL query which returns all the data you need in one request. On the other hand, the overhead for doing the same with Redis is rather low — while it'd be great to avoid it if you can, it's doable.

This is completely a function of the in-memory nature of Redis.

---

## Capabilities

### Redis as a Cache

The most common deployment scenario. The root keys and values of Redis map to the keys and values in our cache. Redis can distribute this hash map trivially across all the nodes of our cluster — if we need more capacity we simply add nodes.

**Example:** Cache a product under key `product:123` with the value stored as a JSON blob or a Redis Hash containing fields like `name`, `price`, and `inventoryCount`.

When using Redis as a cache, you'll often employ a **time to live (TTL)** on each key. Redis guarantees you'll never read the value of a key after the TTL has expired and the TTL is used to decide which items to evict from the server.

> **Note:** Using Redis as a cache doesn't solve the **"hot key" problem** — though Redis is not unique in this respect vs alternatives like Memcached or DynamoDB.

---

### Redis as a Distributed Lock

Occasionally we have data in our system and we need to maintain consistency during updates (e.g. *Design Ticketmaster*), or we need to make sure multiple people aren't performing an action at the same time (e.g. *Design Uber*).

> If your core database can provide consistency, don't rely on a distributed lock which may introduce extra complexity and issues.

**Simple lock with timeout using atomic `INCR` + TTL:**

1. Run `INCR` on the lock key
2. If the response is `1` → you acquired the lock (you were first), proceed
3. If the response is `> 1` → someone else has the lock, wait and retry
4. When done, `DEL` the key so other processes can acquire it

For airtight solutions, use the **Redlock algorithm** together with **fencing tokens**.

---

### Redis for Leaderboards

Redis' **sorted sets** maintain ordered data which can be queried in **O(log N)** time, making them appropriate for leaderboard applications. The high write throughput and low read latency make this especially useful at scale where a SQL DB will start to struggle.

**Example — Top posts by keyword:**

```bash
ZADD tiger_posts 500 "SomeId1"        # Add the Tiger Woods post
ZADD tiger_posts 1 "SomeId2"          # Add some tweet about zoo tigers
ZREMRANGEBYRANK tiger_posts 0 -6      # Remove all but the top 5 posts
```

---

### Redis for Rate Limiting

A common algorithm is a **fixed-window rate limiter** where we guarantee that the number of requests does not exceed `N` over some fixed window of time `W`.

**Implementation:**

1. When a request comes in, `INCR` the key for our rate limiter
2. If the response is `> N`, reject/wait
3. If `<= N`, proceed
4. Call `EXPIRE` on the key so that after time period `W`, the value resets

> **Sliding window variant:** Store timestamps in a Sorted Set per key and remove old entries before counting; run the check in **Lua** to keep it atomic.

---

### Redis for Proximity Search

Redis natively supports geospatial indexes:

```bash
GEOADD key longitude latitude member
GEOSEARCH key FROMLONLAT longitude latitude BYRADIUS radius unit
```

The search command runs in **O(N + log(M))** time where:
- **N** = number of elements in the radius
- **M** = number of items inside the shape

**Why both N and M?** Redis' geospatial commands use **geohashes** under the hood. These allow grabbing candidates in grid-aligned bounding boxes (square and imprecise). A second pass filters candidates to only include items within the exact radius.

---

### Redis for Event Sourcing

Redis' **streams** are append-only logs similar to Kafka's topics. The basic idea: durably add items to a log and then have a distributed mechanism for consuming items from these logs. Redis solves this with **streams** (`XADD`) and **consumer groups** (`XREADGROUP`, `XCLAIM`).

**Example — Work Queue:**

1. Add items to the queue with `XADD`
2. Attach a single consumer group for workers
3. The consumer group maintains a reference to processed items
4. If a worker fails, a new worker can `XCLAIM` and restart processing that message

---

### Redis for Pub/Sub

Redis natively supports a **publish/subscribe** messaging pattern, allowing messages to be broadcast to multiple subscribers in real time. Useful for chat systems, real-time notifications, or decoupling producers from consumers.

```bash
SPUBLISH channel message    # Send message to all subscribers (S = sharded)
SSUBSCRIBE channel          # Listen for messages on channel
```

**Key characteristics:**

- Messages are **not persisted** — if a subscriber is offline, it misses the message
- Delivery is **"at most once"**
- Pub/Sub clients use a **single connection to each node** (not per channel)
- You don't need millions of connections even with millions of channels
- Redis Pub/Sub is now **sharded**, enabling scalability not possible in previous versions

> **Need durability?** Use Redis Streams, or pair Pub/Sub with a queue (SNS→SQS, Kafka) or outbox pattern.

#### Can I Roll My Own Pub/Sub?

Some candidates propose: *"Instead of using Redis Pub/Sub, create keys for each topic with the server address as value. When publishing, look up the key and send directly to that server."*

**Why native Pub/Sub is better:**

| | Native Pub/Sub | Homegrown Approach |
|---|---|---|
| **Network hops** | 2 (client → node → subscribers) | 3 (client → Redis → lookup → each server) |
| **TCP connections** | Already established and held open | Must establish new connections per publish |
| **Memory management** | Channels auto-removed when last subscriber disconnects | Requires heartbeat/TTL mechanism to detect dead servers |
| **Complexity** | Minimal | High (heartbeats, TTLs, connection management) |

**Bottom line:** If you have a use-case that seems like Pub/Sub, use Pub/Sub!

---

## Shortcomings and Remediations

### Hot Key Issues

If load is not evenly distributed across keys in a Redis cluster, you can run into the **"hot key" issue**.

**Example:** An ecommerce store with 100 Redis nodes and evenly spread items. One day, a single item goes viral — the volume for this item matches the volume for all other items combined. That one server is now dramatically overloaded.

**Remediations:**

| Strategy | Description |
|---|---|
| **In-memory client cache** | Reduce requests to Redis for frequently accessed data |
| **Key replication** | Store the same data under multiple keys, randomize requests to spread across cluster |
| **Read replicas** | Add read replica instances and dynamically scale with load |

> For an interview setting, the important thing is that you **recognize** potential hot key issues (+) and that you **proactively design remediations** (++).

---

## Interview Questions & Answers

### Q1: Why is Redis single-threaded, and how can it still be so fast?

**Answer:** Redis is single-threaded for its core data operations to avoid the overhead of context switching, locking, and synchronization that comes with multi-threading. It achieves high performance because:

- All data is **in-memory**, so there's no disk I/O bottleneck for reads/writes
- Operations are **simple and O(1) or O(log N)** — no complex query planning
- It uses **I/O multiplexing** (epoll/kqueue) to handle many connections on a single thread
- No lock contention means every operation executes without waiting

> Redis 6+ introduced **I/O threads** for reading/writing network data, but command execution remains single-threaded.

---

### Q2: How does Redis handle persistence, and what are the tradeoffs?

**Answer:** Redis offers two persistence mechanisms:

| Mechanism | How it works | Tradeoff |
|---|---|---|
| **RDB (Snapshots)** | Periodically saves a point-in-time snapshot to disk | Fast recovery but potential data loss between snapshots |
| **AOF (Append-Only File)** | Logs every write operation | More durable but larger files and slower recovery |

You can use **both together** for a balance of safety and performance. With `appendfsync always`, you get near-full durability but at a performance cost. With `appendfsync everysec`, you risk losing at most 1 second of data.

For full durability guarantees, consider **AWS MemoryDB** which provides Redis-compatible API with disk-based durability.

---

### Q3: Explain how Redis Cluster distributes data. What are hash slots?

**Answer:** Redis Cluster divides the keyspace into **16,384 hash slots**. Each key is mapped to a slot using `CRC16(key) % 16384`. Each node in the cluster is responsible for a subset of these slots.

**How it works:**
1. Client computes the hash slot for a key
2. Client looks up which node owns that slot (cached locally)
3. Client sends the command directly to that node
4. If the slot has moved, the node responds with `MOVED <slot> <new-node>`, and the client updates its map

**Limitation:** Multi-key operations only work if all keys map to the **same hash slot**. You can force this using **hash tags**: `{user:123}:profile` and `{user:123}:settings` will both map to the same slot because Redis only hashes the content inside `{}`.

---

### Q4: What is the "hot key" problem and how do you solve it?

**Answer:** A hot key occurs when a disproportionate amount of traffic is directed at a single key, overloading the node responsible for that key's hash slot.

**Solutions:**
1. **Client-side caching** — cache hot values locally with a short TTL to reduce Redis hits
2. **Key sharding** — split `product:123` into `product:123:1`, `product:123:2`, etc., and randomly pick one when reading. This spreads load across multiple nodes
3. **Read replicas** — add replicas for the hot node and route reads to them
4. **Application-level awareness** — detect hot keys (via `redis-cli --hotkeys`) and apply specific strategies per key

---

### Q5: How would you implement a distributed lock with Redis? What are the pitfalls?

**Answer:**

**Simple approach (single node):**
```bash
SET lock_key unique_value NX PX 30000  # NX = only if not exists, PX = expire in ms
```
- Acquire: `SET ... NX` returns OK if lock acquired
- Release: Use a Lua script to atomically check that the value matches before deleting (prevents releasing someone else's lock)

**Pitfalls of single-node locks:**
- If the Redis node fails, the lock is lost
- Clock drift can cause TTL-based issues

**Redlock algorithm (multi-node):**
1. Acquire the lock on N/2+1 independent Redis nodes
2. If the majority succeeds within a time threshold, the lock is acquired
3. Use **fencing tokens** (monotonically increasing values) to prevent stale lock holders from making writes

**Key pitfall:** During a network partition or GC pause, a client may think it holds the lock when it has actually expired. Fencing tokens protect against this at the storage layer.

---

### Q6: Redis Pub/Sub vs Redis Streams — when to use which?

**Answer:**

| Feature | Pub/Sub | Streams |
|---|---|---|
| **Persistence** | No — fire and forget | Yes — append-only log |
| **Delivery guarantee** | At most once | At least once (with consumer groups) |
| **Consumer groups** | No | Yes — supports multiple consumer groups |
| **Message replay** | Not possible | Yes — read from any point in the stream |
| **Offline consumers** | Miss messages | Can catch up on missed messages |
| **Use case** | Real-time notifications, chat, live updates | Event sourcing, work queues, audit logs |

**Rule of thumb:** Use Pub/Sub for ephemeral real-time broadcasting. Use Streams when you need durability, replay, or reliable processing.

---

### Q7: How would you use Redis for rate limiting? Compare fixed-window vs sliding-window.

**Answer:**

**Fixed-window:**
```bash
INCR rate:user123:1700000000    # Increment counter for current window
EXPIRE rate:user123:1700000000 60  # Expire after window duration
```
- Simple and memory-efficient
- **Drawback:** Burst at window boundaries — a user could make 2N requests across two adjacent window edges

**Sliding-window (sorted set):**
```bash
ZADD rate:user123 <timestamp> <unique_id>     # Add request timestamp
ZREMRANGEBYSCORE rate:user123 0 <old_cutoff>   # Remove expired entries
ZCARD rate:user123                              # Count requests in window
```
- More accurate, no boundary burst problem
- **Drawback:** Higher memory usage (stores each request timestamp)
- Wrap in a **Lua script** to keep the check-and-update atomic

---

### Q8: What's the difference between Redis and Memcached? When would you choose one over the other?

**Answer:**

| Feature | Redis | Memcached |
|---|---|---|
| **Data structures** | Rich (strings, hashes, sets, sorted sets, streams, etc.) | Simple key-value (strings only) |
| **Persistence** | RDB + AOF options | None |
| **Replication** | Built-in primary-replica | Not built-in |
| **Clustering** | Native cluster with hash slots | Client-side consistent hashing |
| **Pub/Sub** | Yes | No |
| **Lua scripting** | Yes | No |
| **Threading** | Single-threaded (I/O threads in 6+) | Multi-threaded |

**Choose Memcached** when you need a simple, multi-threaded cache for string values and your workload is purely cache (no persistence, no complex data types).

**Choose Redis** for everything else — especially when you need data structures, persistence, pub/sub, or scripting.

---

### Q9: How would you design a leaderboard system using Redis?

**Answer:** Use **sorted sets** where the score represents the ranking metric.

```bash
ZADD leaderboard 1500 "player:alice"
ZADD leaderboard 2300 "player:bob"
ZADD leaderboard 1800 "player:charlie"

ZREVRANGE leaderboard 0 9 WITHSCORES    # Top 10 players
ZRANK leaderboard "player:alice"         # Alice's rank (0-indexed, ascending)
ZREVRANK leaderboard "player:alice"      # Alice's rank (descending)
ZINCRBY leaderboard 100 "player:alice"   # Alice scores 100 more points
```

**At scale:**
- Sorted sets handle millions of members efficiently (O(log N) for inserts and lookups)
- For global leaderboards with extreme write volume, shard by region and merge periodically
- Use `ZREMRANGEBYRANK` to prune and keep only top-N entries if memory is a concern

---

### Q10: Can Redis replace Kafka for event streaming?

**Answer:** Redis Streams share similarities with Kafka topics but have important differences:

| Feature | Redis Streams | Kafka |
|---|---|---|
| **Storage** | In-memory (with optional persistence) | Disk-based (log segments) |
| **Throughput** | High but memory-bound | Very high, disk-optimized |
| **Retention** | Memory-limited, must trim manually (`XTRIM`) | Time/size-based retention policies |
| **Consumer groups** | Yes | Yes |
| **Partitioning** | One stream per key (manual sharding) | Built-in topic partitions |
| **Ecosystem** | Lightweight | Rich (Connect, Schema Registry, ksqlDB) |

**Use Redis Streams** for lightweight event processing, low-latency requirements, or when you already have Redis and the volume is manageable.

**Use Kafka** for high-throughput, long-retention event streaming, complex event processing pipelines, or when you need the broader Kafka ecosystem.

---

### Q11: How does Redis handle failover in a cluster?

**Answer:**

1. Each primary node has one or more **replica nodes**
2. Nodes communicate via a **gossip protocol**, exchanging heartbeats
3. If a primary node stops responding, replicas and other nodes mark it as `PFAIL` (possibly failed)
4. When a **majority of primary nodes** agree a node is unreachable, it's marked `FAIL`
5. One of the failed node's replicas is **elected** as the new primary (using a Raft-like election)
6. The new primary takes over the hash slots and announces itself to the cluster
7. Clients receiving `MOVED` responses update their slot-to-node mapping

**Caveats:**
- Writes acknowledged by the old primary but not yet replicated to the new primary are **lost**
- Redis prioritizes **availability and performance** over strong consistency (AP in CAP terms)
- For stronger guarantees, use `WAIT` command to ensure replication before acknowledging writes

---

### Q12: What are Redis hash tags and why are they important?

**Answer:** Hash tags let you control which hash slot a key maps to by wrapping part of the key in `{}`.

```bash
SET {user:123}:profile "..."
SET {user:123}:settings "..."
SET {user:123}:cart "..."
```

Redis only hashes the content inside `{}` — so all three keys above map to the **same hash slot** and therefore the **same node**.

**Why it matters:**
- Multi-key commands (`MGET`, `SUNION`, etc.) require all keys to be on the same node
- Lua scripts that touch multiple keys need them co-located
- Transactions (`MULTI`/`EXEC`) only work within a single node

**Caution:** Overusing hash tags can create hot spots if too many keys funnel into one slot. Design your key scheme to balance co-location needs with even distribution.
