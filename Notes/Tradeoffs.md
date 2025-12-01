# System Design Tradeoffs Guide

A comprehensive reference for understanding key tradeoffs in system design interviews. This guide explains when to use each approach, why, and what you gain or sacrifice.

---

## Table of Contents

1. [Database Tradeoffs](#database-tradeoffs)
2. [Caching Strategies](#caching-strategies)
3. [Storage Tradeoffs](#storage-tradeoffs)
4. [Communication Patterns](#communication-patterns)
5. [Scalability Patterns](#scalability-patterns)
6. [Consistency vs Availability](#consistency-vs-availability)
7. [Data Processing](#data-processing)
8. [API Design](#api-design)
9. [Architecture Patterns](#architecture-patterns)
10. [Performance Optimization](#performance-optimization)

---

## Database Tradeoffs

### SQL vs NoSQL

| Aspect | SQL (Relational) | NoSQL | When to Use |
|--------|-----------------|-------|-------------|
| **Data Model** | Structured, fixed schema with relations | Flexible schema, document/key-value/graph | Use SQL for complex relationships; NoSQL for flexible, rapidly changing data |
| **ACID Compliance** | Strong ACID guarantees | Often eventual consistency (some offer ACID) | Use SQL for financial transactions; NoSQL for high throughput, eventual consistency OK |
| **Scalability** | Vertical scaling (scale up); horizontal with sharding complexity | Horizontal scaling built-in | Use SQL for moderate scale; NoSQL for massive scale-out needs |
| **Query Flexibility** | Rich SQL queries, joins, aggregations | Limited queries; optimized for specific access patterns | Use SQL for ad-hoc analytics; NoSQL for known access patterns |
| **Performance** | Slower writes due to ACID overhead; optimized reads with indexes | Fast writes; read performance depends on data model | Use SQL for read-heavy with complex queries; NoSQL for write-heavy workloads |
| **Examples** | MySQL, PostgreSQL, Oracle | MongoDB, Cassandra, DynamoDB, Redis | |

**Why Choose SQL:**
- Need strong consistency and ACID transactions (banking, e-commerce orders)
- Complex queries with multiple joins (reporting, analytics)
- Well-defined schema that doesn't change frequently
- Team expertise with SQL

**Why Choose NoSQL:**
- Need to scale horizontally to handle massive traffic (social media feeds, IoT)
- Schema flexibility for rapidly evolving features (startups, prototyping)
- Simple key-value or document lookups (user profiles, session storage)
- Geographic distribution with eventual consistency acceptable

**Tradeoff Summary:**
- SQL: Consistency + Complex Queries ↔ Harder to scale horizontally
- NoSQL: Scalability + Flexibility ↔ Limited query capabilities, eventual consistency

---

### Read Replicas vs Sharding

| Aspect | Read Replicas | Sharding (Horizontal Partitioning) | When to Use |
|--------|---------------|-----------------------------------|-------------|
| **Purpose** | Scale read throughput | Scale both reads and writes; handle large datasets | Use replicas for read-heavy; sharding for write-heavy or large data |
| **Write Scaling** | No (all writes go to primary) | Yes (writes distributed across shards) | Sharding when write traffic exceeds single DB capacity |
| **Read Scaling** | Yes (distribute reads across replicas) | Yes (each shard handles subset of reads) | Both scale reads; replicas simpler for read-only scaling |
| **Data Size** | All data on each replica | Data partitioned across shards | Sharding when data doesn't fit on single node |
| **Complexity** | Low (just replication setup) | High (partition key selection, rebalancing, cross-shard queries) | Replicas for simplicity; sharding when necessary for scale |
| **Consistency** | Replication lag (eventual consistency for reads) | Depends on implementation; can be strong per shard | Both have consistency tradeoffs |
| **Failure Impact** | Read capacity reduced; primary still handles writes | Shard unavailable affects subset of data | Replicas: graceful degradation; Sharding: partial outage |

**Why Choose Read Replicas:**
- Read:write ratio is 10:1 or higher (news sites, blogs, product catalogs)
- Need to offload reporting/analytics queries from primary
- Geographic distribution of read traffic
- Simple to implement and maintain

**Why Choose Sharding:**
- Write throughput exceeds single database capacity (high-frequency trading, IoT ingestion)
- Dataset size exceeds single server storage (multi-TB datasets)
- Need to isolate tenant data (multi-tenant SaaS)
- Combined with replicas for maximum scale

**Tradeoff Summary:**
- Replicas: Easy to implement + Read scalability ↔ No write scaling
- Sharding: Write + Read scalability + Large data ↔ High complexity, cross-shard queries difficult

---

### Normalization vs Denormalization

| Aspect | Normalization | Denormalization | When to Use |
|--------|--------------|----------------|-------------|
| **Data Redundancy** | Minimal (DRY principle) | High (data duplicated) | Normalize to save storage; denormalize for performance |
| **Write Performance** | Faster (single location update) | Slower (update multiple locations) | Normalize for write-heavy; denormalize for read-heavy |
| **Read Performance** | Slower (requires joins) | Faster (pre-joined data) | Denormalize for low-latency reads |
| **Data Integrity** | Easier (single source of truth) | Harder (risk of inconsistency) | Normalize for critical data accuracy |
| **Storage Cost** | Lower | Higher | Normalize when storage is expensive; denormalize when reads are expensive |
| **Use Case** | OLTP (transactional systems) | OLAP (analytics, reporting), NoSQL databases | |

**Why Choose Normalization:**
- Data integrity is critical (user accounts, financial records)
- Write-heavy workload (frequent updates to same entities)
- Storage costs are high
- Data changes frequently

**Why Choose Denormalization:**
- Read performance is critical (newsfeed, product search)
- Read:write ratio is very high
- Willing to sacrifice consistency for speed
- Pre-computed aggregations needed (dashboards, leaderboards)

**Tradeoff Summary:**
- Normalization: Data integrity + Storage efficiency ↔ Slow reads (joins)
- Denormalization: Fast reads ↔ Data redundancy + Update complexity

---

## Caching Strategies

### Cache Aside vs Write-Through vs Write-Behind

| Strategy | How It Works | Pros | Cons | When to Use |
|----------|-------------|------|------|-------------|
| **Cache Aside (Lazy Loading)** | App checks cache first; on miss, loads from DB and populates cache | Simple; cache contains only requested data; resilient to cache failures | Initial request is slow (cache miss); stale data possible | Read-heavy with unpredictable access patterns (user profiles, product pages) |
| **Write-Through** | App writes to cache and DB synchronously | Cache always consistent with DB; read hits are fast | Write latency (two writes); wasted cache space for unread data | Read-heavy with critical consistency (inventory, pricing) |
| **Write-Behind (Write-Back)** | App writes to cache; cache asynchronously writes to DB | Fast writes; reduced DB load; batch writes possible | Risk of data loss if cache fails; eventual consistency | Write-heavy with acceptable data loss risk (analytics events, logs) |
| **Refresh-Ahead** | Cache proactively refreshes before expiration | Reduced latency; no cache miss penalty | Wasted resources if data not accessed; complex to implement | Predictable access patterns (homepage, trending content) |

**Why Choose Each:**
- **Cache Aside**: Most flexible and common pattern; works when you don't know what to cache upfront
- **Write-Through**: Need strong consistency between cache and DB
- **Write-Behind**: Extremely high write throughput needed, can tolerate data loss
- **Refresh-Ahead**: Predictable access patterns, zero cache miss tolerance

**Tradeoff Summary:**
- Cache Aside: Flexibility + Resilience ↔ Cache misses, stale data
- Write-Through: Consistency ↔ Write latency
- Write-Behind: Write performance ↔ Data loss risk, complexity

---

## Storage Tradeoffs

### Object Storage vs Block Storage vs File Storage

| Aspect | Object Storage (S3) | Block Storage (EBS) | File Storage (EFS/NFS) | When to Use |
|--------|-------------------|-------------------|----------------------|-------------|
| **Access Pattern** | HTTP API (REST) | Direct block access | File system (POSIX) | Object: web/API; Block: DB; File: shared access |
| **Performance** | High throughput, moderate IOPS | Very high IOPS, low latency | Moderate throughput, good for concurrent access | Block for databases; Object for media; File for shared workloads |
| **Scalability** | Unlimited (horizontal) | Limited by volume size | Scales automatically (petabytes) | Object for massive scale; Block for single-instance; File for multi-instance |
| **Cost** | Lowest ($/GB) | Moderate to high | Moderate (higher than Object) | Object for archival; Block for performance; File for shared |
| **Use Cases** | Static assets, backups, data lakes | Databases, boot volumes | Shared code, content management | |

**Why Choose Object Storage:**
- Static website assets, backups, data lakes
- Cost-effective at massive scale
- Global distribution via CDN

**Why Choose Block Storage:**
- Database storage, high-IOPS applications
- Low-latency requirements

**Why Choose File Storage:**
- Shared access across multiple servers
- Content management systems, ML training data

**Tradeoff Summary:**
- Object: Unlimited scale + Low cost ↔ Higher latency
- Block: High performance ↔ Limited scale
- File: Shared access ↔ Higher cost

---

## Communication Patterns

### Synchronous vs Asynchronous

| Aspect | Synchronous (HTTP/gRPC) | Asynchronous (Message Queue) | When to Use |
|--------|------------------------|------------------------------|-------------|
| **Coupling** | Tight (caller waits) | Loose (fire and forget) | Sync: real-time; Async: decouple services |
| **Latency** | Low (immediate response) | Higher (eventual processing) | Sync: user-facing; Async: background jobs |
| **Reliability** | Retry in caller | Built-in retry, DLQ | Async for mission-critical tasks |
| **Scalability** | Limited (caller blocks) | High (queue absorbs spikes) | Async for traffic spikes |

**Why Choose Synchronous:**
- User needs immediate response (login, search)
- Simple request-response workflows
- Low latency critical

**Why Choose Asynchronous:**
- Long-running tasks (video transcoding)
- Decouple services for resilience
- Handle traffic spikes

**Tradeoff Summary:**
- Sync: Simple + Immediate ↔ Tight coupling
- Async: Decoupling + Scalability ↔ Complexity

---

## Scalability Patterns

### Vertical vs Horizontal Scaling

| Aspect | Vertical (Scale Up) | Horizontal (Scale Out) | When to Use |
|--------|-------------------|----------------------|-------------|
| **Approach** | Bigger server | More servers | Vertical: quick fix; Horizontal: long-term |
| **Limit** | Hardware limit | Virtually unlimited | Horizontal when vertical hits limits |
| **Cost** | Non-linear | Linear | Horizontal more cost-effective at scale |
| **Complexity** | Simple | Complex (distributed) | Vertical for simplicity |
| **Downtime** | Required | Zero (rolling) | Horizontal for high availability |

**Why Choose Vertical:**
- Quick wins, legacy apps, starting out

**Why Choose Horizontal:**
- High availability, predictable costs, massive scale

**Tradeoff Summary:**
- Vertical: Simple ↔ Limited, expensive
- Horizontal: Unlimited scale ↔ Complexity

---

## Consistency vs Availability

### CAP Theorem Tradeoffs

| Choice | Guarantees | Sacrifice | Use Cases |
|--------|-----------|----------|-----------|
| **CP** | Consistency + Partition Tolerance | Availability | Banking, inventory, auctions |
| **AP** | Availability + Partition Tolerance | Consistency | Social feeds, analytics, caching |

**Why Choose CP:**
- Financial transactions, inventory management
- Data correctness > uptime

**Why Choose AP:**
- Social media, real-time analytics
- Uptime > immediate consistency

**Tradeoff Summary:**
- CP: Data correctness ↔ May be unavailable
- AP: Always available ↔ Stale data possible

---

## Data Processing

### Batch vs Stream Processing

| Aspect | Batch | Stream | When to Use |
|--------|-------|--------|-------------|
| **Latency** | High (hours) | Low (milliseconds) | Batch: reports; Stream: real-time |
| **Volume** | Large | Small (per record) | Batch: historical; Stream: live |
| **Complexity** | Simpler | Complex | Batch for simplicity |
| **Cost** | Lower | Higher | Batch for cost-sensitive |

**Why Choose Batch:**
- Daily reports, ML training, ETL jobs
- Cost-effective for non-time-sensitive

**Why Choose Stream:**
- Real-time fraud detection, live dashboards
- Event-driven architectures

**Tradeoff Summary:**
- Batch: Cost-effective ↔ High latency
- Stream: Low latency ↔ Higher cost, complexity

---

## Architecture Patterns

### Monolith vs Microservices

| Aspect | Monolith | Microservices | When to Use |
|--------|---------|--------------|-------------|
| **Deployment** | Single unit | Multiple services | Monolith: startups; Microservices: mature |
| **Scalability** | Scale entire app | Scale independently | Microservices: heterogeneous scaling |
| **Development** | Simple | Complex | Monolith: small teams |
| **Fault Isolation** | Entire app | Service-level | Microservices: resilience |

**Why Choose Monolith:**
- Early-stage startup, small team, simple domain

**Why Choose Microservices:**
- Large org, distinct domains, team autonomy

**Tradeoff Summary:**
- Monolith: Simplicity ↔ Limited scalability
- Microservices: Independent scaling ↔ Complexity

---

## Summary: Decision Framework

When faced with tradeoffs:

1. **Non-functional requirements**: Latency, throughput, availability, consistency
2. **Read:write ratio**: Affects caching, replication, sharding decisions
3. **Data access patterns**: Determines DB choice (SQL vs NoSQL)
4. **Team size/expertise**: Influences architecture complexity
5. **Cost constraints**: Impacts infrastructure choices
6. **Failure tolerance**: Determines redundancy and consistency levels

**Remember**: Every architecture decision is a tradeoff. Choose based on your specific requirements, constraints, and priorities.
