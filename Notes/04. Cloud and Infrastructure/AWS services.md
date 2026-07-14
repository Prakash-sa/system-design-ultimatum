# AWS Services Comparison Guide

A comprehensive reference for comparing widely-used AWS services across compute, containers, storage, databases, networking, and messaging categories.

---

## Container Orchestration

### ECS on EC2 vs ECS with Fargate

| Feature | ECS on EC2 | ECS with Fargate |
|---------|-----------|------------------|
| **Management** | You manage the EC2 instances (OS patching, scaling, monitoring, security updates) | Serverless — AWS handles all infrastructure, no servers to manage |
| **Control** | Full control over EC2 instance type, AMI, configuration, and underlying hardware | Limited control; AWS manages compute resources automatically |
| **Cost Model** | Pay for EC2 instances (running 24/7), even if not fully utilized. Can leverage Reserved Instances or Savings Plans for cost optimization | Pay only for vCPU and memory your tasks actually consume (per-second billing), no idle instance costs |
| **Scaling** | You configure and manage Auto Scaling Groups for EC2 capacity; requires capacity planning | Automatically provisions resources per task; scales instantly without pre-provisioning |
| **Startup Time** | Faster task placement if capacity already exists in cluster | Slight cold-start delay (10-30s) for new tasks as Fargate provisions resources |
| **Networking** | Tasks can use host networking mode or bridge mode; fine-grained control | Each task gets its own ENI (Elastic Network Interface) with dedicated IP |
| **Use Case** | Workloads needing specific hardware (GPU, high memory), sustained high utilization, cost optimization through granular management, or custom AMIs | Teams prioritizing simplicity, variable/bursty workloads, microservices, or wanting zero infrastructure management |
| **Best For** | Predictable, steady-state workloads; cost-sensitive with reservation commitments; need for custom instance configurations | Unpredictable traffic patterns, rapid scaling needs, development/staging environments, modern serverless architectures |

### ECS vs EKS (Elastic Kubernetes Service)

| Feature | Amazon ECS | Amazon EKS |
|---------|-----------|-----------|
| **Orchestration** | AWS-native, proprietary container orchestration | Full Kubernetes (K8s) — open-source, CNCF standard |
| **Complexity** | Simpler to set up and manage; AWS-opinionated defaults | Steeper learning curve; requires Kubernetes expertise and YAML configurations |
| **Ecosystem** | Deep integration with AWS services (IAM, CloudWatch, ALB, Secrets Manager) | Broad Kubernetes ecosystem; works with Helm, Istio, Prometheus, and multi-cloud tools |
| **Portability** | AWS-only; not portable to other clouds or on-premises | Highly portable across AWS, GCP, Azure, on-prem, and hybrid environments |
| **Control Plane Cost** | No additional control plane fee; pay only for compute (EC2 or Fargate) | \$0.10/hour (~\$73/month) per EKS cluster for the managed control plane |
| **API & Tooling** | ECS CLI, AWS Console, CloudFormation, CDK | kubectl, Helm, K8s manifests, extensive third-party tooling |
| **Multi-tenancy** | Service-level isolation; can run multiple services in one cluster | Namespace-based multi-tenancy; stronger isolation with RBAC and network policies |
| **Use Case** | Simpler applications, teams heavily invested in AWS, lower operational overhead | Complex microservices, multi-cloud strategies, GitOps workflows, need for K8s ecosystem tools |
| **Best For** | Startups, AWS-first teams, rapid prototyping, lower management burden | Enterprises with Kubernetes expertise, avoiding vendor lock-in, need for advanced orchestration features |

---

## Compute Services

### EC2 vs Lambda vs Fargate

| Feature | EC2 (Elastic Compute Cloud) | AWS Lambda | AWS Fargate |
|---------|----------------------------|-----------|-------------|
| **Model** | Virtual machines (VMs) you manage | Serverless functions (event-driven) | Serverless containers |
| **Management** | You manage OS, patching, scaling, monitoring | AWS manages all infrastructure; you only deploy code | AWS manages servers; you manage container images |
| **Pricing** | Pay for instance runtime (per second/hour), even if idle | Pay per request + execution time (100ms increments); generous free tier (1M requests/month) | Pay for vCPU and memory per second of container runtime |
| **Scaling** | Manual or Auto Scaling Groups; requires capacity planning | Automatic, event-driven scaling (0 to thousands instantly) | Automatic per-task scaling; no pre-provisioning |
| **Execution Duration** | Unlimited (long-running workloads) | Max 15 minutes per invocation | Unlimited (long-running containers) |
| **Use Case** | Persistent workloads, databases, legacy apps, full control needed | Event-driven workloads (API backends, data processing, automation), stateless functions | Containerized apps without infrastructure management, microservices |
| **Cold Start** | N/A (always running) | Yes (milliseconds to seconds, depending on runtime and package size) | Yes (10-30 seconds for new tasks) |
| **Best For** | Databases, monolithic apps, high-performance computing, custom OS/kernel requirements | Microservices, real-time file/stream processing, scheduled tasks, APIs with variable traffic | Containerized microservices, batch jobs, CI/CD workloads, teams avoiding server management |

---

## Storage Services

### S3 vs EBS vs EFS

| Feature | S3 (Simple Storage Service) | EBS (Elastic Block Store) | EFS (Elastic File System) |
|---------|----------------------------|---------------------------|--------------------------|
| **Type** | Object storage (REST API, HTTP access) | Block storage (attached to single EC2 instance) | Managed NFS (Network File System) |
| **Access Pattern** | Accessed via HTTP/S (REST API, SDKs, CLI) | Low-latency block-level access (direct attach) | Concurrent access from multiple EC2 instances (NFS protocol) |
| **Durability** | 99.999999999% (11 nines); data replicated across ≥3 AZs | 99.8-99.9% (single AZ); use snapshots to S3 for cross-AZ durability | 99.999999999% (11 nines); replicated across multiple AZs |
| **Performance** | Optimized for throughput (not IOPS); S3 Intelligent-Tiering, Glacier for archival | High IOPS (up to 256K IOPS with io2 Block Express); low latency | Bursting or provisioned throughput; lower IOPS than EBS but supports thousands of connections |
| **Scalability** | Virtually unlimited storage | Limited by volume size (16 TiB max for most types; 64 TiB for io2 Block Express) | Automatically scales to petabytes; pay for what you use |
| **Pricing** | Pay per GB stored + requests + data transfer | Pay for provisioned capacity (GB/month) + IOPS (for io1/io2) | Pay per GB used (no pre-provisioning); higher \$/GB than S3 but lower than EBS |
| **Use Case** | Static website hosting, data lakes, backups, archival, media distribution, analytics | Boot volumes, databases, low-latency transactional workloads, single-instance applications | Shared file storage for multiple instances, content management, web serving, dev environments |
| **Lifecycle** | Object-level versioning, lifecycle policies (transition to Glacier, Intelligent-Tiering) | Snapshots for point-in-time backups (incremental, stored in S3) | Lifecycle policies (transition infrequent-access data to EFS IA) |
| **Best For** | Unstructured data, logs, static assets, backups, big data | High-performance databases (MySQL, PostgreSQL), boot drives, low-latency apps | Shared workloads, containerized apps needing shared state, machine learning training data |

---

## Database Services

### RDS vs DynamoDB vs Aurora

| Feature | RDS (Relational Database Service) | DynamoDB | Aurora |
|---------|-----------------------------------|----------|--------|
| **Type** | Managed relational DB (MySQL, PostgreSQL, MariaDB, Oracle, SQL Server) | Managed NoSQL key-value & document DB | MySQL/PostgreSQL-compatible relational DB (AWS-optimized) |
| **Data Model** | Relational (tables, rows, SQL joins) | Key-value & document (JSON); no joins, no schema | Relational (SQL, ACID transactions) |
| **Scaling** | Vertical (instance size); read replicas for horizontal read scaling | Automatic horizontal scaling (partition keys); on-demand or provisioned capacity | Automatic storage scaling (up to 128 TiB); up to 15 read replicas for horizontal read scaling |
| **Performance** | Moderate; dependent on instance type and storage (IOPS) | Single-digit millisecond latency at any scale; designed for high throughput | 5x faster than MySQL, 3x faster than PostgreSQL (AWS claims); low-latency replication |
| **Availability** | Multi-AZ for HA (synchronous standby replica); manual failover ~1-2 min | 99.99% SLA; multi-region replication with Global Tables | 99.99% SLA; automatic failover in <30 seconds; multi-master for write scaling |
| **Pricing** | Pay for instance hours + storage (GB) + I/O requests + backups | Pay per read/write request unit + storage (GB); on-demand or provisioned | Pay for instance hours + storage (billed per GB-month used, auto-scaling) + I/O requests |
| **Backup & Recovery** | Automated backups (point-in-time restore up to 35 days); manual snapshots | Point-in-time recovery (PITR) up to 35 days; on-demand backups | Continuous backups to S3; PITR; fast database cloning (copy-on-write) |
| **Use Case** | Traditional OLTP apps, existing SQL apps, complex queries with joins, ACID compliance | High-scale apps (gaming, IoT, real-time analytics), key-value access patterns, serverless backends | High-performance relational workloads, SaaS apps, need for rapid read scaling and HA |
| **Best For** | Lift-and-shift migrations, apps requiring SQL joins and transactions, legacy compatibility | Serverless architectures, event-driven apps, need for predictable single-digit latency at scale | Mission-critical apps requiring extreme availability and performance, global databases |

### RDS vs Redshift

| Feature | RDS | Redshift |
|---------|-----|----------|
| **Type** | OLTP (Online Transaction Processing) — row-based | OLAP (Online Analytical Processing) — columnar data warehouse |
| **Workload** | Transactional queries (inserts, updates, deletes), small reads/writes | Complex analytics, aggregations, reporting, BI dashboards |
| **Data Volume** | Optimized for GBs to a few TBs | Optimized for TBs to PBs (petabyte-scale) |
| **Query Performance** | Optimized for low-latency single-row lookups | Optimized for large scans, aggregations, and parallel queries |
| **Scaling** | Vertical (larger instance) or read replicas | Horizontal (add nodes to cluster); massively parallel processing (MPP) |
| **Use Case** | E-commerce, SaaS apps, CRM, transactional workloads | Data warehousing, business intelligence, big data analytics |
| **Best For** | Operational databases with frequent writes | Historical data analysis, reporting, ETL pipelines |

---

## Networking & Content Delivery

### ALB vs NLB vs CLB

| Feature | ALB (Application Load Balancer) | NLB (Network Load Balancer) | CLB (Classic Load Balancer - Legacy) |
|---------|--------------------------------|----------------------------|--------------------------------------|
| **Layer** | Layer 7 (HTTP/HTTPS) | Layer 4 (TCP/UDP/TLS) | Layer 4 & 7 (basic) |
| **Use Case** | Web applications, microservices, container-based apps | High-performance, low-latency apps; static IP, millions of requests/sec | Legacy apps (not recommended for new workloads) |
| **Features** | Path-based routing, host-based routing, Lambda targets, WebSocket, HTTP/2 | Ultra-low latency, static IPs, preserves source IP, PrivateLink support | Basic load balancing (round-robin) |
| **Performance** | Millions of requests per second (app layer) | Millions of requests per second (ultra-low latency, <100µs) | Lower performance; no advanced features |
| **Health Checks** | HTTP/HTTPS (path-based) | TCP, HTTP, HTTPS | TCP, HTTP/HTTPS |
| **Best For** | APIs, microservices, HTTP routing logic, containerized apps | Gaming, IoT, real-time streaming, need for static IPs or extreme performance | Legacy migrations only |

### CloudFront vs S3 Transfer Acceleration

| Feature | CloudFront | S3 Transfer Acceleration |
|---------|-----------|-------------------------|
| **Type** | CDN (Content Delivery Network) | Upload acceleration for S3 |
| **Use Case** | Global content delivery (static/dynamic), caching, low latency for end users | Faster uploads to S3 from distant locations |
| **Edge Locations** | 400+ edge locations worldwide (caching) | Uses CloudFront edge locations for upload optimization |
| **Performance** | Caches content at edge; reduces origin load | Up to 50-500% faster uploads over long distances |
| **Best For** | Serving static assets (images, videos, JS/CSS), streaming, API acceleration | Large file uploads (media, backups) from global clients |

---

## Messaging & Integration

### SQS vs SNS vs Kinesis

| Feature | SQS (Simple Queue Service) | SNS (Simple Notification Service) | Kinesis Data Streams |
|---------|---------------------------|-----------------------------------|---------------------|
| **Pattern** | Queue (point-to-point, pull-based) | Pub/Sub (push-based, fan-out) | Real-time streaming (ordered, replayable) |
| **Use Case** | Decoupling microservices, async task queues, job processing | Event notifications (email, SMS, Lambda, HTTP endpoints), fan-out to multiple consumers | Real-time analytics, log aggregation, event streaming, clickstreams |
| **Message Retention** | 1 minute to 14 days (configurable) | No retention (fire-and-forget); messages delivered immediately | 24 hours to 365 days (configurable) |
| **Ordering** | Standard queue (best-effort); FIFO queue (strict ordering within message group) | No ordering guarantee | Strict ordering per shard (partition key) |
| **Delivery** | Pull-based (consumers poll); at-least-once delivery (Standard), exactly-once (FIFO) | Push-based; at-least-once delivery to subscribers | Pull-based (consumers read from shards); at-least-once delivery |
| **Throughput** | Unlimited (Standard); up to 3,000 msg/sec with batching (FIFO) | Unlimited fan-out; each topic can have thousands of subscribers | Configurable (1 MB/sec write per shard; scale by adding shards) |
| **Consumers** | One consumer processes each message (queue) | Multiple subscribers receive each message (broadcast) | Multiple consumers can read the same stream (replay capability) |
| **Best For** | Async job queues, order processing, decoupling services | Event broadcasting, mobile push notifications, alarm systems | Real-time dashboards, fraud detection, IoT telemetry, log processing |

### EventBridge vs SNS

| Feature | EventBridge | SNS |
|---------|------------|-----|
| **Type** | Event bus (serverless event routing) | Pub/Sub messaging |
| **Routing** | Advanced pattern matching (filter on event attributes), schema registry | Topic-based; simple filtering with message attributes |
| **Integrations** | Native integration with 90+ AWS services + SaaS apps (Zendesk, Datadog, etc.) | Integrates with Lambda, SQS, HTTP, email, SMS |
| **Use Case** | Event-driven architectures, cross-account events, SaaS integrations | Simple pub/sub, mobile notifications, alarm routing |
| **Best For** | Complex event routing, application integration, serverless workflows | Broadcasting messages to multiple endpoints, simple fan-out |

---

## Key Takeaways

- **Compute**: EC2 for control, Lambda for event-driven serverless, Fargate for containerized serverless.
- **Containers**: ECS for AWS-native simplicity, EKS for Kubernetes portability.
- **Storage**: S3 for objects/archives, EBS for block storage (single instance), EFS for shared file systems.
- **Databases**: RDS for relational OLTP, DynamoDB for NoSQL at scale, Aurora for high-performance relational, Redshift for analytics.
- **Networking**: ALB for HTTP routing, NLB for low-latency TCP/UDP, CloudFront for global CDN.
- **Messaging**: SQS for queues, SNS for pub/sub, Kinesis for streaming, EventBridge for event routing.

Use this guide as a quick reference when architecting solutions or preparing for system design interviews.
EOF