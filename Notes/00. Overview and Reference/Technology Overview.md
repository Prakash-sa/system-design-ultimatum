# Tools Internal Design: Read-Aloud Notes

Use this page to quickly revise how important system design tools work internally, the key points to say clearly, and the tradeoffs each one brings.

## Navigation Bar

| Topic | Topic | Topic | Topic |
|---|---|---|---|
| [**Airflow Temporal**](#airflow-temporal) | [**API Gateway**](#api-gateway) | [**Cassandra**](#cassandra) | [**CDN**](#cdn) |
| [**CI CD**](#ci-cd) | [**Data Warehouse OLAP**](#data-warehouse-olap) | [**Database Indexes**](#database-indexes) | [**Deployment Strategies**](#deployment-strategies) |
| [**DNS**](#dns) | [**Docker**](#docker) | [**DynamoDB**](#dynamodb) | [**Elasticsearch OpenSearch**](#elasticsearch-opensearch) |
| [**Flink Kafka Streams**](#flink-kafka-streams) | [**Geospatial Indexing**](#geospatial-indexing) | [**GraphQL**](#graphql) | [**gRPC**](#grpc) |
| [**HPC Slurm MPI GPU**](#hpc-slurm-mpi-gpu) | [**Infrastructure as Code**](#infrastructure-as-code) | [**Kafka**](#kafka) | [**Kubernetes**](#kubernetes) |
| [**Lambda**](#lambda) | [**Load Balancer**](#load-balancer) | [**MongoDB**](#mongodb) | [**OAuth OIDC JWT SSO**](#oauth-oidc-jwt-sso) |
| [**Object Storage S3**](#object-storage-s3) | [**Observability**](#observability) | [**PostgreSQL MySQL Aurora**](#postgresql-mysql-aurora) | [**Rate Limiter**](#rate-limiter) |
| [**Redis**](#redis) | [**REST**](#rest) | [**Secrets and KMS**](#secrets-and-kms) | [**Service Mesh**](#service-mesh) |
| [**SNS EventBridge PubSub**](#sns-eventbridge-pubsub) | [**Spark**](#spark) | [**SQS RabbitMQ Celery**](#sqs-rabbitmq-celery) | [**Vector Database RAG**](#vector-database-rag) |
| [**WebSocket SSE**](#websocket-sse) | [**ZooKeeper KRaft**](#zookeeper-kraft) |  |  |

## Quick Acronym Reference

Use these full forms when naming tools: **DNS (Domain Name System)**, **CDN (Content Delivery Network)**, **TTL (Time To Live)**, **TCP (Transmission Control Protocol)**, **UDP (User Datagram Protocol)**, **TLS (Transport Layer Security)**, **WAF (Web Application Firewall)**, **API (Application Programming Interface)**, **HTTP (Hypertext Transfer Protocol)**, **URL (Uniform Resource Locator)**, **SDK (Software Development Kit)**, **S3 (Simple Storage Service)**, **REST (Representational State Transfer)**, **RPC (Remote Procedure Call)**, **gRPC (Remote Procedure Call framework)**, **SSE (Server-Sent Events)**, **OAuth (Open Authorization)**, **OIDC (OpenID Connect)**, **JWT (JSON Web Token)**, **SSO (Single Sign-On)**, **RBAC (Role-Based Access Control)**, **MFA (Multi-Factor Authentication)**, **HPC (High Performance Computing)**, **MPI (Message Passing Interface)**, **GPU (Graphics Processing Unit)**, **ML (Machine Learning)**, **CPU (Central Processing Unit)**, **PID (Process Identifier)**, **CNI (Container Network Interface)**, **HPA (Horizontal Pod Autoscaler)**, **mTLS (Mutual Transport Layer Security)**, **DLQ (Dead-Letter Queue)**, **ACID (Atomicity, Consistency, Isolation, Durability)**, **WAL (Write-Ahead Log)**, **MVCC (Multi-Version Concurrency Control)**, **LSM-tree (Log-Structured Merge Tree)**, **RDB (Redis Database snapshot)**, **AOF (Append-Only File)**, **GSI (Global Secondary Index)**, **LSI (Local Secondary Index)**, **SSTable (Sorted String Table)**, **JSON (JavaScript Object Notation)**, **CDC (Change Data Capture)**, **ISR (In-Sync Replicas)**, **SNS (Simple Notification Service)**, **Pub/Sub (Publish/Subscribe)**, **KRaft (Kafka Raft metadata mode)**, **DAG (Directed Acyclic Graph)**, **ETL (Extract, Transform, Load)**, **OLAP (Online Analytical Processing)**, **OLTP (Online Transaction Processing)**, **MPP (Massively Parallel Processing)**, **BI (Business Intelligence)**, **RAG (Retrieval-Augmented Generation)**, **LLM (Large Language Model)**, **HNSW (Hierarchical Navigable Small World)**, **IVF (Inverted File Index)**, **SLO (Service Level Objective)**, **CI/CD (Continuous Integration / Continuous Delivery)**, **IaC (Infrastructure as Code)**, **KMS (Key Management Service)**, and **IAM (Identity and Access Management)**.

## **Airflow** **Temporal**

**Airflow** is a **DAG (Directed Acyclic Graph)** **scheduler** for batch workflows. Internally, DAGs define task dependencies, the **scheduler** determines ready tasks, **executors** run tasks on workers, and a metadata database tracks task state. **Temporal** is a durable workflow engine that persists **workflow state** and replays workflow code after failures, while activities perform external side effects.

**Key points:** **DAG (Directed Acyclic Graph)**, **scheduler**, executor, task, worker, retry, backfill, **workflow state**, activity, and **idempotency**.

**Tradeoff:** workflow reliability versus framework complexity. **Airflow** is strong for scheduled ETL and data pipelines, while **Temporal** is strong for long-running business workflows. Both require careful retry, timeout, and **idempotency** design because failures are normal.

## API Gateway

An **API gateway** is the controlled entry point into backend **services**. Internally, it maps public API routes to internal **services** and commonly handles **authentication**, **authorization**, **rate limiting**, request validation, protocol translation, logging, and response shaping. It may use static routing configuration or service discovery to locate live **services**.

**Key points:** auth enforcement, throttling, **API versioning**, request shaping, **schema** validation, centralized logging, and client-specific routing.

**Tradeoff:** centralized control versus gateway coupling. API gateways reduce duplicated cross-cutting code across **services**, but if too much business logic moves into the gateway, it becomes hard to change and scale. The gateway should enforce common policies while domain logic stays inside **services**.

## **Cassandra**

**Cassandra** is a distributed wide-column database built for high write throughput and availability. Internally, nodes form a peer-to-peer ring, **consistent hashing** maps **partitions** to nodes, writes go to **commit log** and **memtable**, memtables flush to SSTables, and **compaction** merges SSTables. Replication factor controls copies, and consistency level controls how many **replicas** must respond.

**Key points:** **partition key**, clustering key, replication factor, consistency level, **commit log**, **memtable**, **SSTable (Sorted String Table)**, **compaction**, tombstone, and repair.

**Tradeoff:** write scalability and availability versus query flexibility and operational care. **Cassandra** works well for time-series, event **logs**, and multi-region write-heavy data, but queries must be modeled upfront, huge **partitions** hurt performance, and **tombstones** can become expensive.

## **CDN**

A **CDN (Content Delivery Network)** is a globally distributed edge caching layer. Internally, edge nodes cache objects using a **cache key** built from host, path, query parameters, headers, and sometimes cookies. If the object is present at the edge, the **CDN** serves it directly; otherwise it fetches from the origin, stores it according to the cache policy, and returns it to the user.

**Key points:** **cache hit ratio**, **TTL (Time To Live)**, invalidation, **origin shield**, **signed URLs (Uniform Resource Locators)**, **signed cookies**, image optimization, video chunks, **WAF (Web Application Firewall)** integration, and **TLS (Transport Layer Security) termination**.

**Tradeoff:** freshness versus performance. Long TTLs improve latency and reduce origin load, but users may see stale content. Short TTLs improve freshness, but reduce **cache hit ratio**. **CDN** is excellent for static assets and media, but personalized or frequently changing data needs careful **cache key** and invalidation design.

## CI CD

**CI/CD (Continuous Integration/Continuous Delivery)** automates build, test, packaging, scanning, and deployment. Internally, a pipeline pulls source code, builds artifacts, runs tests and security checks, stores versioned artifacts, deploys to environments, and verifies health.

**Key points:** pipeline, **artifact**, build, test, lint, security scan, registry, environment, approval gate, deployment verification, and **rollback**.

**Tradeoff:** release speed versus pipeline discipline. **CI/CD** enables repeatable and auditable releases, but bad pipelines can promote broken artifacts quickly. Production pipelines should include automated tests, **health checks**, **rollback**, and environment-specific configuration outside the **artifact**.

## Data Warehouse **OLAP**

**OLAP (Online Analytical Processing)** systems store analytical data optimized for scans, joins, and aggregations. Internally, systems like Redshift, BigQuery, Snowflake, and ClickHouse use **columnar storage**, compression, **partitions**, clustering, materialized views, query planners, and **MPP (Massively Parallel Processing)** execution across many workers.

**Key points:** **columnar storage**, fact table, dimension table, partition, clustering, **MPP**, materialized view, and **BI (Business Intelligence)** query.

**Tradeoff:** analytical speed versus transactional behavior. Warehouses are excellent for dashboards, reporting, historical analysis, and BI, but they are not designed for low-latency **OLTP (Online Transaction Processing)** writes. Data freshness depends on batch **ETL (Extract, Transform, Load)**, **ELT (Extract, Load, Transform)**, **CDC (Change Data Capture)**, or **streaming** ingestion.

## Database Indexes

Indexes are auxiliary data structures that make reads faster. Internally, **B-tree (Balanced Tree)** **indexes** keep keys sorted for equality and range queries, **hash indexes** support equality lookup, **inverted indexes** map terms to documents for search, **composite indexes** store multiple fields in order, and **covering indexes** include all fields needed by a query. **LSM-tree (Log-Structured Merge Tree)** engines write to memory first and later compact sorted files on disk.

**Key points:** selectivity, cardinality, composite index order, covering index, query plan, write amplification, and pagination **indexes**.

**Tradeoff:** read speed versus write cost and storage. Every index must be updated when data changes, so too many **indexes** slow writes and increase disk usage. Good **indexes** match real access patterns, not hypothetical queries.

## Deployment Strategies

Deployment strategies control how new versions reach users. Internally, rolling deployment gradually replaces instances, **blue-green** maintains two environments and switches traffic, **canary** sends a small percentage of traffic to the new version, **feature flags** separate deploy from release, and A/B testing routes cohorts for comparison.

**Key points:** rollout, traffic shift, health check, automated **rollback**, feature flag, **canary** metric, cohort, and blast radius.

**Tradeoff:** safety versus cost and complexity. Rolling deployments are simple but mix versions temporarily. Blue-green gives fast **rollback** but doubles environment cost. Canary reduces risk but requires strong **metrics** and routing control. Feature flags are powerful but create long-lived conditional code if not cleaned up.

## **DNS**

**DNS (Domain Name System)** is a hierarchical distributed naming system that converts domain names into IP addresses. Internally, a client usually asks a recursive resolver, and that resolver may contact root servers, TLD servers, and authoritative name servers before returning a record such as `A`, `AAAA`, `CNAME`, `MX`, `TXT`, or `NS`. The answer is cached at several layers, including browser, OS, resolver, ISP, and public **DNS** **resolvers**.

**Key point:** **DNS** happens before **TCP (Transmission Control Protocol)**/**TLS (Transport Layer Security)** connection setup and that global systems use **DNS** for latency routing, geo routing, weighted routing, and regional failover.

**Tradeoff:** **DNS** improves global routing and availability, but failover is not instant because records are cached until **TTL** expiry. A low **TTL** gives faster failover but creates more **DNS** traffic, while a high **TTL** reduces **DNS** load but slows migration and failover.

## **Docker**

**Docker** packages an application with its runtime, dependencies, filesystem layers, and metadata. Internally, **Docker** **images** are immutable layered filesystems, and **containers** are isolated processes created from those **images**. Isolation uses Linux **namespaces** for process, network, mount, and **PID (Process Identifier)** boundaries, while **cgroups** enforce **CPU (Central Processing Unit)** and memory limits.

**Key points:** image, container, registry, layer, namespace, cgroup, volume, port mapping, and multi-stage build.

**Tradeoff:** portability and repeatable deployment versus host-level abstraction. Containers are lighter than virtual machines because they share the host kernel, but that also means kernel compatibility and container isolation must be understood. Small **images** improve security, startup time, and deploy speed.

## **DynamoDB**

**DynamoDB** is a managed partitioned key-value and document database. Internally, data is distributed by **partition key**, optionally ordered by **sort key**, and served from physical **partitions** that scale behind the scenes. Global secondary **indexes** provide alternate access patterns, **conditional writes** provide **concurrency** control, and streams capture item-level changes.

**Key points:** **partition key**, **sort key**, item collection, **GSI (Global Secondary Index)**, **LSI (Local Secondary Index)**, conditional write, **TTL (Time To Live)**, streams, on-demand capacity, provisioned capacity, and **single-table design**.

**Tradeoff:** massive managed scale versus access-pattern-driven modeling. **DynamoDB** is excellent when queries are predictable and partition keys distribute traffic evenly, but it is weak for arbitrary ad hoc joins and flexible querying. Bad partition keys create hot **partitions**.

## **Elasticsearch** **OpenSearch**

**Elasticsearch**/**OpenSearch** is a distributed search engine. Internally, documents are stored in **indexes**, **indexes** are split into **shards** and **replicas**, **analyzers** tokenize and normalize text, and **inverted indexes** map terms to document IDs. Coordinating nodes receive queries, data nodes execute shard-level search, and results are merged and ranked.

**Key points:** index, document, shard, replica, analyzer, tokenizer, inverted index, **relevance score**, refresh interval, and reindexing.

**Tradeoff:** powerful search versus duplicated derived data. Search engines are excellent for full-text search, autocomplete, filters, **logs**, and aggregations, but they are usually not the source of truth. You must keep the search index in sync through **CDC (Change Data Capture)**, events, or background jobs.

## **Flink** **Kafka** Streams

Stream processors continuously process unbounded event streams. Internally, operators transform events, stateful operators keep local state, checkpoints save state for recovery, windows group events, and **watermarks** track event-time progress for late data. **Kafka** Streams runs as an application library, while **Flink** runs as a distributed stream processing engine.

**Key points:** **event time**, processing time, window, watermark, checkpoint, state store, exactly-once, late event, and duplicate handling.

**Tradeoff:** real-time processing versus state and correctness complexity. Stream processing is ideal for fraud detection, alerts, dashboards, and sessionization, but late events, duplicate events, state growth, **checkpointing**, and recovery semantics must be designed explicitly.

## **Geospatial** Indexing

**Geospatial** systems make latitude/longitude searchable. Internally, grid systems like **H3** and **S2** divide Earth into cells, nearby search checks the current cell plus neighboring cells, **PostGIS** uses spatial **indexes** such as GiST, and **Redis** Geo uses sorted sets with **geohash**-like encoding.

**Key points:** **geohash**, **S2**, **H3**, cell, neighbor expansion, radius query, bounding box, spatial index, and exact distance filtering.

**Tradeoff:** precision versus query speed. Coarser cells are faster but less precise, while smaller cells improve precision but require checking more cells. For dense urban regions, systems often combine cell lookup with exact distance filtering and load-aware **partitioning**.

## **GraphQL**

**GraphQL** exposes a typed **schema** where clients ask for exactly the fields they need. Internally, requests are executed through **resolvers**, and each resolver may call databases, **services**, caches, or batch loaders. A good **GraphQL** server controls query depth, complexity, batching, **authorization**, and persisted queries.

**Key points:** **schema**, query, mutation, subscription, resolver, **DataLoader**, **N+1 problem**, query planner, and field-level **authorization**.

**Tradeoff:** client flexibility versus backend protection complexity. **GraphQL** reduces over-fetching and helps mobile clients, but arbitrary queries can overload backend systems if complexity limits, caching, and resolver batching are not designed carefully.

## **gRPC**

**gRPC (Remote Procedure Call framework)** is a high-performance **RPC (Remote Procedure Call)** framework built around **Protocol Buffers** and usually **HTTP/2 (Hypertext Transfer Protocol version 2)**. Internally, `.proto` files define service contracts and message schemas, then code generation produces strongly typed clients and servers. **HTTP/2** provides multiplexing, binary framing, header compression, and **streaming**.

**Key points:** unary RPC, server **streaming**, client **streaming**, bidirectional **streaming**, **deadlines**, metadata, status codes, and **schema** evolution.

**Tradeoff:** performance and type safety versus browser friendliness and operational simplicity. **gRPC** is excellent for internal microservice calls, but **REST** is easier for browsers, public APIs, manual debugging, and simple integrations. **gRPC** requires disciplined versioning because clients and servers depend on shared contracts.

## HPC **Slurm** **MPI** GPU

**HPC (High Performance Computing)** systems run compute-heavy jobs across clusters. Internally, **Slurm** queues jobs and schedules them on compute nodes, **MPI (Message Passing Interface)** lets processes across machines communicate through message passing, **OpenMP (Open Multi-Processing)** parallelizes **CPU (Central Processing Unit)** threads inside one machine, and **GPUs (Graphics Processing Units)** accelerate highly parallel numerical or **ML (Machine Learning)** workloads.

**Key points:** **scheduler**, queue, partition, node, rank, communicator, GPU allocation, shared filesystem, high-speed network, and data movement.

**Tradeoff:** maximum throughput and hardware utilization versus interactive service simplicity. HPC clusters are excellent for simulations, scientific computing, and large-scale training, but scheduling, I/O bottlenecks, synchronization, networking, and data locality often dominate performance.

## **Infrastructure as Code**

**Infrastructure as Code** stores infrastructure definitions in versioned code. Internally, tools compare desired state with real infrastructure and apply changes. **Terraform** uses providers, resources, modules, **state files**, plans, and remote locks; CloudFormation/CDK uses AWS stacks; Helm templates **Kubernetes** resources.

**Key points:** desired state, plan, apply, state, module, provider, **drift**, stack, lock, and environment.

**Tradeoff:** repeatability versus state management complexity. **IaC (Infrastructure as Code)** gives reviewable and reproducible infrastructure, but **state files**, **drift**, module boundaries, and environment promotion require discipline. Remote state locking is important to prevent concurrent conflicting changes.

## **Kafka**

**Kafka** is a distributed append-only **commit log**. Internally, producers write events to **topics**, **topics** are split into **partitions**, each partition is an ordered log, **brokers** store and replicate **partitions**, leaders handle reads/writes for **partitions**, followers replicate from leaders, and consumers read by **offset**. Consumer groups divide **partitions** across consumers for parallelism.

**Key points:** broker, topic, partition, leader, replica, **ISR (In-Sync Replicas)**, **ack (acknowledgment)**, **offset**, **consumer group**, retention, **compaction**, **partition key**, and **consumer lag**.

**Tradeoff:** durable replayable **streaming** versus operational complexity. **Kafka** is excellent for event pipelines, **CDC (Change Data Capture)**, **logs**, analytics, and event-driven architectures, but ordering is only within a partition, **partition key** choice is critical, and teams must monitor lag, disk usage, broker health, and rebalancing.

## **Kubernetes**

**Kubernetes** is a container orchestration system based on declarative desired state. Internally, the **API (Application Programming Interface) server** accepts cluster changes, **etcd** stores cluster state, the **scheduler** assigns **pods** to nodes, **controllers** reconcile resources, **kubelet** runs **containers** on each node, and **CNI (Container Network Interface)**/kube-proxy provide networking.

**Key points:** pod, deployment, service, ingress, namespace, configmap, secret, **HPA (Horizontal Pod Autoscaler)**, persistent volume, **readiness probe**, **liveness probe**, and rolling update.

**Tradeoff:** automation and platform consistency versus operational complexity. **Kubernetes** is strong for large microservice platforms, autoscaling, self-healing, and service discovery, but it requires expertise in networking, security, resource management, upgrades, and observability.

## **Lambda**

**Lambda** runs code in managed isolated execution environments. Internally, an event source invokes a function handler, and the platform either creates a new runtime environment during **cold start** or reuses a warm environment from a previous invocation. Scaling happens by increasing concurrent execution environments.

**Key points:** handler, event source, **cold start**, **warm start**, **concurrency**, timeout, memory size, retries, **DLQ (Dead-Letter Queue)**, and **idempotency**.

**Tradeoff:** operational simplicity versus runtime constraints. **Lambda** is good for event-driven processing, scheduled tasks, lightweight APIs, and file processing, but cold starts, timeout limits, **concurrency** limits, vendor coupling, and debugging complexity matter for larger workflows.

## Load Balancer

A load balancer accepts client traffic and forwards it to healthy backend targets. Internally, **Layer 4** load balancers route TCP or UDP flows using IP and port, while **Layer 7** load balancers understand **HTTP** and can route by host, path, header, method, or cookie. They use **health checks** to remove bad instances and algorithms such as round-robin, least connections, weighted routing, **consistent hashing**, and latency-based routing.

**Key points:** **TLS termination**, **health checks**, **connection pooling**, **sticky sessions**, slow-start, backend draining, and request routing.

**Tradeoff:** control and resilience versus extra infrastructure complexity. L7 load balancers provide powerful routing and visibility but add latency and can become a critical dependency. L4 load balancers are faster and simpler for TCP/UDP workloads but cannot make rich **HTTP** routing decisions.

## **MongoDB**

**MongoDB** stores **JSON (JavaScript Object Notation)**-like documents in collections. Internally, documents can contain nested objects and arrays, **indexes** support common queries, **replica sets** provide high availability, the **oplog** replicates changes from primary to secondaries, and sharding distributes collections by **shard key**.

**Key points:** document, collection, index, replica set, primary, secondary, **oplog**, **shard key**, aggregation pipeline, and **schema** validation.

**Tradeoff:** flexible document modeling versus consistency of structure and shard-key design. **MongoDB** is useful when data naturally fits document shapes and evolves quickly, but production systems still need **schema** discipline, **indexes**, and careful **shard key** selection to avoid hot **shards**.

## OAuth OIDC **JWT** **SSO**

**OAuth2 (Open Authorization 2.0)** is an **authorization** framework, **OIDC (OpenID Connect)** adds **authentication** and identity, **JWT (JSON Web Token)** is a signed token format, and **SSO (Single Sign-On)** centralizes login through an identity provider. Internally, users authenticate with an identity provider, receive tokens, and present **access tokens** to resource servers. Services verify **JWT** signature, issuer, audience, expiry, claims, and scopes using public keys from **JWKS (JSON Web Key Set)**.

**Key points:** access token, refresh token, **authorization** server, resource server, scopes, claims, **RBAC (Role-Based Access Control)**, **MFA (Multi-Factor Authentication)**, and token rotation.

**Tradeoff:** stateless scalability versus revocation complexity. JWTs are easy for distributed **services** to verify without a central session store, but they are hard to revoke before expiry. Short-lived **access tokens** plus refresh token rotation are a common solution.

## Object Storage **S3**

Object storage such as **S3 (Simple Storage Service)** stores files as objects inside buckets, addressed by **object keys**. Internally, each object contains bytes, metadata, access policy, version information, storage class, and replication state. Clients access objects over **HTTP (Hypertext Transfer Protocol)** APIs, **SDKs (Software Development Kits)**, **presigned URLs (Uniform Resource Locators)**, **lifecycle policies**, and event notifications. Large objects use **multipart upload**, and object events can trigger downstream processors.

**Key points:** **bucket**, key, metadata, **multipart upload**, presigned URL, versioning, replication, lifecycle rules, and **CDN (Content Delivery Network)** integration.

**Tradeoff:** durability and scale versus low-level filesystem behavior. Object storage is excellent for **images**, videos, backups, **logs**, static assets, and data lakes, but it is not suitable for low-latency random block updates. A common design stores file metadata in a database and the actual bytes in **object storage**.

## **Observability**

**Observability** combines **metrics**, **logs**, and **traces** to understand production behavior. Internally, applications emit telemetry through agents or SDKs, **metrics** are stored as time series, **logs** are indexed as events, and **traces** connect spans across **services** using trace IDs and correlation IDs.

**Key points:** **metrics**, **logs**, **traces**, span, trace ID, correlation ID, p50, p95, p99, error rate, saturation, **SLO (Service Level Objective)**, and **OpenTelemetry**.

**Tradeoff:** visibility versus cost and noise. Rich telemetry helps debug outages and enforce SLOs, but high-cardinality **metrics**, excessive **logs**, and full trace sampling can become expensive. Good systems choose useful signals: latency, traffic, errors, saturation, queue depth, **consumer lag**, and **DLQ** size.

## **PostgreSQL** **MySQL** **Aurora**

Relational databases store structured data in tables with schemas, **indexes**, constraints, and transactions. Internally, the query planner chooses execution plans using statistics, the buffer pool caches pages, **WAL (Write-Ahead Log)**/binlog records changes for durability and replication, and **MVCC (Multi-Version Concurrency Control)** allows concurrent readers and writers using row versions.

**Key points:** **ACID (Atomicity, Consistency, Isolation, Durability)**, transaction isolation, **WAL**, **MVCC**, **indexes**, query planner, replication, **read replicas**, **partitioning**, **connection pooling**, and failover.

**Tradeoff:** strong correctness and query flexibility versus harder horizontal write scaling. Relational databases are ideal for users, orders, payments, inventory, and source-of-truth data, but very high write scale may require **partitioning**, sharding, denormalization, or moving some access patterns to specialized stores.

## Rate Limiter

A rate limiter protects systems by controlling how many requests an identity can make over time. Internally, common algorithms include **fixed window** counters, **sliding window** **logs**, **sliding window** counters, **token bucket**, and **leaky bucket**. **Redis** is often used because counters, TTLs, sorted sets, and **Lua scripts** make distributed **rate limiting** fast and atomic.

**Key points:** limits by user ID, IP, tenant, API key, endpoint, and service, plus `429 Too Many Requests`, retry metadata, and abuse protection.

**Tradeoff:** accuracy versus cost and latency. Sliding window **logs** are accurate but memory-heavy. Fixed windows are cheap but allow boundary bursts. Token buckets are practical because they allow controlled bursts while enforcing long-term rate. Distributed **rate limiting** also needs shared state or approximate local limits.

## **Redis**

**Redis** is an in-memory data structure server. Internally, it supports strings, hashes, lists, sets, sorted sets, streams, bitmaps, HyperLogLog, Bloom filters, and geospatial **indexes**. Command execution is mostly single-threaded, which makes each command atomic and predictable. Persistence uses **RDB (Redis Database snapshot)** snapshots and **AOF (Append-Only File)** **logs**, and **Redis** Cluster **partitions** keys across hash slots.

**Key points:** **TTL (Time To Live)**, eviction, cache-aside, sorted set, atomic counter, Lua script, stream, **Pub/Sub (Publish/Subscribe)**, primary-replica, and cluster hash slot.

**Tradeoff:** very low latency versus memory cost and durability limits. **Redis** is excellent for caching, sessions, counters, **rate limiting**, leaderboards, locks, and hot metadata, but the database should remain the source of truth for critical durable data unless **Redis** persistence and replication are explicitly designed for that requirement.

## **REST**

**REST (Representational State Transfer)** exposes resources over **HTTP (Hypertext Transfer Protocol)** using **URLs (Uniform Resource Locators)**, methods, headers, status codes, and bodies. Internally, `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` communicate the operation, while headers carry auth, caching, pagination, content type, tracing, and **idempotency** metadata.

**Key points:** resource-oriented URLs, correct status codes, **cursor pagination**, cache headers, **ETags (Entity Tags)**, **idempotency keys**, and **API (Application Programming Interface) versioning**.

**Tradeoff:** simplicity and compatibility versus efficiency for complex clients. **REST** is easy to debug and widely supported, but it can over-fetch or under-fetch data. For public APIs and CRUD-style resources, **REST** is usually the default; for high-throughput internal service calls, **gRPC** may be more efficient.

## Secrets and **KMS**

**Secrets managers** store credentials, certificates, API keys, and database passwords, while **KMS (Key Management Service)** manages encryption keys. Internally, **KMS** commonly uses **envelope encryption**: a data key encrypts the data, and a master key encrypts the data key. **IAM (Identity and Access Management)** policies control who can read secrets or use keys, and audit **logs** record key usage.

**Key points:** secret rotation, **least privilege**, **envelope encryption**, key policy, audit log, versioned secrets, and access boundary.

**Tradeoff:** stronger security versus operational overhead. Secrets and **KMS** reduce blast radius and improve auditability, but key rotation, access policies, environment wiring, and emergency recovery must be planned. Never store secrets in source code, **images**, **logs**, or plain configuration files.

## Service Mesh

A service mesh adds a proxy layer, often sidecars, around service-to-service communication. Internally, the data plane proxies intercept traffic, while the control plane pushes policies for **mTLS (Mutual Transport Layer Security)**, routing, retries, timeouts, circuit breaking, traffic splitting, and telemetry.

**Key points:** **sidecar proxy**, **mTLS (Mutual Transport Layer Security)**, service identity, traffic shaping, **canary** routing, distributed tracing, and **Envoy**/Istio/Linkerd.

**Tradeoff:** consistent network policy versus extra moving parts. **Service mesh** reduces duplicated networking code in **services** and improves observability, but it adds latency, resource usage, configuration complexity, and another control plane to operate.

## **SNS** **EventBridge** PubSub

**Pub/Sub (Publish/Subscribe)** systems broadcast events from publishers to many subscribers. Internally, **SNS (Simple Notification Service)** uses **topics** and subscriptions, while **EventBridge** uses event buses, rules, event patterns, and targets. Subscribers may be queues, functions, **HTTP** endpoints, streams, or other **services**.

**Key points:** topic, subscriber, event bus, rule, target, filtering, **fanout**, retry, and event **schema**.

**Tradeoff:** easy **fanout** versus weaker control over end-to-end **workflow state**. **Pub/Sub** is excellent when one event should trigger multiple independent workflows, but each subscriber must handle retries, duplicates, ordering limitations, and failure isolation.

## **Spark**

**Spark** is a distributed batch processing engine. Internally, the **driver** builds a logical plan, the cluster manager allocates **executors**, **executors** run tasks over **partitions**, transformations build a **DAG (Directed Acyclic Graph)**, and actions trigger execution. Shuffles redistribute data across **executors** for joins, group-bys, and aggregations.

**Key points:** **driver**, executor, partition, **DAG**, transformation, action, **shuffle**, cache, checkpoint, skew, and file layout.

**Tradeoff:** large-scale throughput versus latency and **shuffle** cost. **Spark** is strong for **ETL (Extract, Transform, Load)**, backfills, analytics, and large joins, but jobs are not low-latency by default, and poor **partitioning** or skew can make shuffles expensive.

## **SQS** **RabbitMQ** **Celery**

Queues decouple producers from workers. Internally, producers enqueue messages, workers consume them, acknowledgments remove processed messages, visibility timeouts hide in-flight messages, retries handle temporary failures, and **dead-letter queues** store poison messages. **RabbitMQ** adds exchanges, queues, bindings, and routing keys, while **Celery** uses a broker plus worker processes for background tasks.

**Key points:** producer, queue, worker, **ack (acknowledgment)**, retry, **visibility timeout**, **DLQ (Dead-Letter Queue)**, **idempotency**, and poison message.

**Tradeoff:** async decoupling versus eventual completion and duplicate handling. Queues are simpler than **Kafka** for background jobs, but messages may be delivered more than once, processing can lag behind, and workers must be idempotent.

## Vector Database **RAG**

**Vector databases** store **embeddings** for similarity search. Internally, an embedding model converts text, **images**, or items into dense vectors, and approximate nearest-neighbor **indexes** such as **HNSW (Hierarchical Navigable Small World)** or **IVF (Inverted File Index)** retrieve similar vectors quickly. **RAG (Retrieval-Augmented Generation)** systems retrieve top-k relevant chunks, optionally rerank them, and send them to an **LLM (Large Language Model)** as context.

**Key points:** embedding, vector index, cosine similarity, dot product, chunking, metadata filter, top-k retrieval, reranking, context window, and permissions.

**Tradeoff:** semantic retrieval power versus quality control and freshness. Vector search is useful for **RAG**, recommendations, duplicate detection, and semantic search, but retrieval quality depends on chunking, embedding model, metadata, evaluation, and re-indexing when documents or models change.

## **WebSocket** **SSE**

**WebSocket** upgrades an **HTTP (Hypertext Transfer Protocol)** request into a persistent full-duplex **TCP (Transmission Control Protocol)** connection, allowing both client and server to send messages at any time. **SSE (Server-Sent Events)** keeps a long-lived **HTTP** response open for one-way server-to-client events. Internally, real-time systems maintain connection registries that map users or sessions to active connection servers, and a **fanout** layer pushes messages to the right connections.

**Key points:** **heartbeat**, reconnect, connection ownership, **fanout**, **backpressure**, message ordering, and presence tracking.

**Tradeoff:** real-time interaction versus connection management cost. WebSockets are powerful for chat, collaboration, games, trading, and live dashboards, but long-lived connections consume memory and require careful scaling. **SSE** is simpler for one-way updates but cannot support bidirectional messaging by itself.

## **ZooKeeper** **KRaft**

**ZooKeeper** is a distributed coordination service using znodes, watches, sessions, and **leader election**. It has historically stored **Kafka** metadata and controller state. **KRaft (Kafka Raft metadata mode)** is **Kafka**'s newer built-in metadata **quorum** based on the Raft consensus protocol, where **controllers** replicate metadata changes and elect a leader.

**Key points:** **quorum**, **leader election**, metadata, watches, session, controller, and consensus.

**Tradeoff:** coordination correctness versus operational overhead. Coordination systems are essential for **leader election** and cluster metadata, but they are sensitive infrastructure. **Kafka**'s move from **ZooKeeper** to **KRaft** reduces external dependencies and simplifies **Kafka** operations.
