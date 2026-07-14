# Storage Tradeoffs

## Object Storage vs Block Storage vs File Storage

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

## Storage Architecture Decision Matrix

| Workload | Best Storage | Why |
|----------|-------------|-----|
| **Database (MySQL, PostgreSQL)** | Block (EBS/NVMe) | Low latency, high IOPS, consistent performance |
| **Static website (HTML, CSS, JS)** | Object (S3) | Unlimited scale, CDN distribution, cost-effective |
| **Log files (append-only)** | Object (S3) | Cheap storage, batch processing friendly |
| **ML training data (large files)** | File (EFS) or Object (S3) | Parallel access, distributed computation |
| **Docker images, artifacts** | Object (S3) + Container Registry | Immutable, versioned, easy distribution |
| **Real-time analytics (data warehouse)** | Object (S3) + Compute (Redshift/BigQuery) | Decoupled storage/compute, cost-effective |
| **Shared code/configs (multi-server)** | File (EFS/NFS) | POSIX semantics, all servers see updates |
| **User uploads (photos, videos)** | Object (S3) | Unlimited scale, resize/transcode on-the-fly |
| **Operating system boot** | Block (EBS) | Fast boot, OS expects block semantics |

---

## Interview Questions & Answers

### Q1: Design Instagram's photo storage. Which storage type?

**Answer:**
**Use Object Storage (S3)** because:
- Unlimited scale: billions of photos
- Cost-effective: photos are immutable after upload
- CDN integration: CloudFront delivers globally
- Resize on-demand: AWS Lambda resizes for thumbnails

**Architecture**:
<details>
<summary>Click to view code</summary>

```
User uploads photo → S3 bucket (original)
                  ↓
Lambda triggered → Generate:
  - Thumbnail (100x100)
  - Medium (500x500)
  - High-res (2000x2000)
  ↓
Store variants in S3
  ↓
CloudFront CDN caches all variants
  ↓
User requests photo → CloudFront (99% cache hit) → S3 on miss
```

</details>

**Cost analysis**:
<details>
<summary>Click to view code</summary>

```
1B photos × 2MB avg = 2 exabytes
S3: $0.023/GB = $46M/year
vs.
Block storage: $0.10/GB = $200M/year  # 4x more expensive

Savings: $154M/year by using Object storage
```

</details>

**Why not Block storage?**
- Cost: 4x more expensive
- No IOPS benefit: photo access is sequential, not random

---

### Q2: Your database is at 99.9% disk utilization. Scale or replace?

**Answer:**
**Option 1: Add Block Storage (faster)**
- Add EBS volume to database
- Migrate data (downtime ~1-2 hours)
- Database can now grow 10x

**Option 2: Shard Database (better)**
- Split users into multiple database instances
- Each DB gets its own block storage
- Distributes load + capacity growth
- Requires application-level sharding key

**Option 3: Use Bigger Instance (simplest)**
- Replace m5.large with m5.4xlarge
- More CPU, memory, AND storage
- No migration complexity
- Still limited to instance size ceiling

**Recommendation**: Combination approach
<details>
<summary>Click to view code</summary>

```
Immediate: Switch to larger instance (gains 3-6 months)
          ↓
Medium-term: Implement sharding (scales indefinitely)
          ↓
Long-term: Move to managed service (RDS, Cloud SQL)
          which handles scaling automatically
```

</details>

---

### Q3: Design a file sharing system like Dropbox. Storage architecture?

**Answer:**
**Hybrid storage**:

1. **Metadata** → Database (PostgreSQL)
   - File names, permissions, timestamps
   - Efficiently queried/updated

2. **File contents** → Object Storage (S3)
   - Actual file data
   - Versioning (keep history)
   - Cost-effective for large files

3. **Sync metadata** → Block Storage (EBS)
   - Sync logs for delta sync
   - Fast writes needed

**Architecture**:
<details>
<summary>Click to view code</summary>

```
User uploads file → 
  1. Store metadata in PostgreSQL
  2. Store file content in S3
  3. Log sync event to EBS

User views folder →
  Query PostgreSQL for metadata → Return file list

User downloads file →
  Get S3 URL from PostgreSQL → Stream from S3

User deletes file →
  Mark soft-delete in PostgreSQL
  Keep S3 object (can restore)
```

</details>

**Why this mix?**
- PostgreSQL: Metadata is small, frequently queried
- S3: Files can be huge, accessed less frequently
- EBS: Sync logs need fast writes

**Cost breakdown**:
<details>
<summary>Click to view code</summary>

```
100GB user × 1M users = 100PB storage
S3: $0.023/GB × 100PB = $2.3M/month
+ Database: $500K/month
+ Bandwidth: $1M/month (CDN)
= $3.8M/month (much cheaper than Block storage for all)
```

</details>

