# System Design Tradeoffs Guide - Master Index

A comprehensive reference for understanding key tradeoffs in system design interviews. This guide explains when to use each approach, why, and what you gain or sacrifice.

---

## Complete Topic List

This master guide has been divided into focused topic files for easier reference. Each file contains:
- Detailed comparison tables
- Deep dives with examples
- Real-world tradeoff analysis
- **Interview questions with answers**

### 1. [Database Tradeoffs](../01. Core Concepts/01-Database-Tradeoffs.md)
SQL vs NoSQL, common databases, geospatial queries (PostgreSQL + PostGIS, Redis Geo, MongoDB, Elasticsearch, DynamoDB, S2/H3 geometry), read replicas vs sharding, normalization vs denormalization, data structures & indexing

**Key topics:**
- When to use SQL vs NoSQL
- Location query patterns (Uber, food delivery, GIS)
- Scaling strategies (read replicas, sharding, geo-partitioning)

### 2. [Caching Strategies](../01. Core Concepts/02-Caching-Strategies.md)
Cache Aside, Write-Through, Write-Behind, Refresh-Ahead patterns with deep dives, TTL strategies, cache invalidation, cache stampede solutions

**Key topics:**
- Cache pattern selection
- TTL tuning for different use cases
- Preventing cascading failures

### 3. [API Design](../01. Core Concepts/03-API-Design.md)
REST vs gRPC vs GraphQL vs WebSockets vs SSE vs WebHooks with comprehensive comparison table, detailed pros/cons, when to use each, real-time patterns

**Key topics:**
- API pattern selection matrix
- Real-time communication (WebSockets vs SSE)
- Mobile vs server API design

### 4. [Storage Tradeoffs](../01. Core Concepts/04-Storage-Tradeoffs.md)
Object Storage (S3) vs Block Storage (EBS) vs File Storage (EFS/NFS), decision matrix, cost analysis, Instagram/Dropbox design examples

**Key topics:**
- Storage type selection
- Cost optimization strategies
- Cloud storage architecture

### 5. [Communication Patterns](../01. Core Concepts/05-Communication-Patterns.md)
Synchronous vs Asynchronous, polling patterns (short/long polling, WebSockets, SSE), message queues (Pub/Sub vs Queue), chaos engineering, retry mechanisms with exponential backoff

**Key topics:**
- Service communication patterns
- Message queue strategies
- Failure handling and resilience

### 6. [Scalability & Reliability](../01. Core Concepts/06-Scalability-Reliability.md)
Vertical vs Horizontal scaling, CAP theorem, load balancing strategies, replication patterns, circuit breaker pattern, multi-region failover, disaster recovery

**Key topics:**
- Scaling decision making
- High availability patterns
- Fault tolerance strategies

### 7. [Data Processing](../01. Core Concepts/07-Data-Processing.md)
Batch vs Stream processing, Lambda vs Kappa architecture, tools comparison (Spark, Flink, Kafka Streams, Kinesis), real-time analytics, data warehouse design for scale

**Key topics:**
- Batch vs stream tradeoffs
- Real-time analytics at scale
- Fraud detection and recommendation systems

### 8. [Architecture Patterns](../01. Core Concepts/08-Architecture-Patterns.md)
Monolith vs Microservices, architecture evolution, when to migrate, data consistency across services, saga pattern, service design principles

**Key topics:**
- Monolith vs microservices decision
- Distributed transaction patterns
- Service boundary design

### 9. [REST & gRPC Best Practices](../01. Core Concepts/09-REST-gRPC-Best-Practices.md)
REST API design principles, HTTP methods semantics, versioning strategies, pagination strategies (offset, cursor, page, seek), filtering & sorting, caching optimization, gRPC proto design, streaming strategies, performance tuning

**Key topics:**
- Resource-oriented REST design
- Pagination for large datasets (100M+ records)
- gRPC for microservices (10K+ QPS)
- API optimization techniques (compression, rate limiting, async)
- Field selection and sparse fieldsets

### 10. [Kafka Deep Dive](../03. Streaming and Coordination/Kafka.md)
Apache Kafka from ground up, core components (brokers, topics, partitions, replicas, consumer groups), producers and consumers, replication and high availability, Zookeeper vs KRaft, performance tuning, monitoring, exactly-once semantics, real-world patterns

**Key topics:**
- Kafka architecture and components
- Producer batching, acknowledgments, idempotence
- Consumer offset management, rebalancing, lag monitoring
- High availability with replication (99.99% uptime)
- Exactly-once payment processing
- Event sourcing and CQRS patterns

### 11. [Design Patterns](../01. Core Concepts/11-Design-Patterns.md)
CQRS, Event Sourcing, Saga Pattern, Circuit Breaker, Bulkhead, Retry with exponential backoff, Eventual Consistency, Sharding, Cache-Aside, Write-Through, Multi-Tenancy, API Gateway, Strangler Fig

**Key topics:**
- CQRS for read/write optimization
- Event Sourcing for audit trails and time-travel
- Saga pattern for distributed transactions
- Fault tolerance patterns (circuit breaker, bulkhead, retry)
- Sharding strategies for scalability
- Migration patterns (strangler fig)
- Multi-tenancy isolation levels
