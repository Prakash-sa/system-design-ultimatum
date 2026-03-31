# Elasticsearch - Complete Deep Dive

## What is Elasticsearch?

**Elasticsearch** is a distributed search and analytics engine built on top of Apache Lucene that enables:
- **Full-text search**: Index and search large volumes of data
- **Real-time analytics**: Aggregate and visualize data instantly
- **Distributed storage**: Horizontal scaling across multiple nodes
- **High availability**: Automatic replication and failover
- **Flexible querying**: Complex boolean queries, fuzzy search, range queries

### Core Characteristics

| Aspect | Benefit |
|--------|---------|
| **Distributed** | Horizontal scaling across nodes/clusters |
| **Fault-tolerant** | Automatic replica placement and recovery |
| **Real-time** | Sub-100ms search latency on large datasets |
| **Schemaless** | Dynamic field mapping (flexible structure) |
| **Horizontally scalable** | Add nodes to increase throughput/storage |
| **Full-text search** | Advanced tokenization, stemming, analyzers |

---

## Elasticsearch Architecture Overview

<details>
<summary>Click to view code</summary>

```
Clients (HTTP/TCP)
       ↓
   [Elasticsearch Cluster]
       ├─ Node 1 (Data + Master eligible)
       ├─ Node 2 (Data + Master eligible)
       ├─ Node 3 (Data + Master eligible)
       └─ Coordinator Node (routes requests)
       ↓
   [Indices] → [Shards] → [Documents]
       ↓
   [Lucene indexes]
```

</details>

**Key layers:**
- **Cluster**: Collection of nodes working together
- **Node**: Single Elasticsearch instance
- **Index**: Like a database table, holds documents
- **Shard**: Partition of an index (enables parallelism)
- **Replica**: Copy of a shard for redundancy
- **Document**: JSON object, basic unit of data

---

## Core Components

### 1. Clusters and Nodes

**Cluster**: Logical grouping of one or more Elasticsearch nodes

<details>
<summary>Click to view code</summary>

```
Production Cluster Setup:

Master nodes (3):
  - Elect cluster leader
  - Manage cluster state
  - No data stored
  - Lightweight, high availability

Data nodes (N):
  - Store indices and shards
  - Execute search/index operations
  - Resource intensive (disk, CPU, RAM)

Coordinator nodes (optional):
  - Route requests to data nodes
  - Reduce load on master nodes
  - No data stored
```

</details>

**Node roles:**
<details>
<summary>Click to view code (yaml)</summary>

```yaml
# Master-eligible node
node.roles: [master, data]

# Data-only node
node.roles: [data]

# Coordinator node (ingest + voting only)
node.roles: [ingest]
```

</details>

---

### 2. Indices and Shards

**Index**: Similar to a database table; stores documents

<details>
<summary>Click to view code</summary>

```
Index: products
  ├─ Shard 0 (Primary) → Replica 0
  │   Docs: 100K
  │   Size: 500MB
  │
  ├─ Shard 1 (Primary) → Replica 1
  │   Docs: 100K
  │   Size: 500MB
  │
  └─ Shard 2 (Primary) → Replica 2
      Docs: 100K
      Size: 500MB
```

</details>

**Shard**: Partition of an index (enables parallel processing)

<details>
<summary>Click to view code</summary>

```
Why shards?
- Parallelism: Multiple shards can be searched simultaneously
- Throughput: Spread writes across shards
- Storage: Each shard is a complete Lucene index
- Distribution: Shards spread across nodes for load balancing

Shard placement strategy:
- Primary shards: Distributed round-robin across nodes
- Replicas: Placed on different nodes than primary
- Example: 5 shards × 2 replicas = 15 total shard copies

Index settings:
{
  "settings": {
    "number_of_shards": 5,    # Initial shards (can't change)
    "number_of_replicas": 2    # Replicas (can be changed)
  }
}
```

</details>

**Replica**: Copy of a shard for redundancy

<details>
<summary>Click to view code</summary>

```
Benefits:
- HA: If primary shard lost, replica promoted to primary
- Search parallelism: Searches hit both primary + replicas
- Read scalability: More replicas = more parallel reads

Trade-offs:
- Disk space: 2 replicas = 3x storage usage
- Network I/O: Replication introduces latency
- Indexing latency: Must replicate to all replicas
```

</details>

---

### 3. Documents and Mappings

**Document**: JSON object indexed in Elasticsearch

<details>
<summary>Click to view code (json)</summary>

```json
{
  "_index": "products",
  "_id": "12345",
  "_type": "_doc",
  "_version": 1,
  "_score": 2.5,
  "_source": {
    "title": "Laptop",
    "price": 999.99,
    "category": "Electronics",
    "tags": ["computer", "portable"],
    "created_at": "2024-01-05T10:00:00Z"
  }
}
```

</details>

**Mapping**: Schema definition for an index

<details>
<summary>Click to view code (json)</summary>

```json
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "standard"
      },
      "price": {
        "type": "float"
      },
      "category": {
        "type": "keyword"
      },
      "tags": {
        "type": "keyword"
      },
      "created_at": {
        "type": "date",
        "format": "strict_date_time"
      }
    }
  }
}
```

</details>

**Field types:**

| Type | Use Case | Searchable | Sortable |
|------|----------|-----------|----------|
| **text** | Full-text search (title, description) | Yes (analyzed) | No |
| **keyword** | Exact match, filtering (category, status) | Yes (not analyzed) | Yes |
| **integer/float** | Numbers (price, quantity) | Yes | Yes |
| **date** | Timestamps | Yes | Yes |
| **nested** | Array of objects (comments, reviews) | Yes | Limited |
| **geo_point** | Latitude/longitude | Yes (geo queries) | Yes |

---

### 4. Inverted Index (Core of Lucene)

**Inverted Index**: Maps terms → documents (enables fast search)

<details>
<summary>Click to view code</summary>

```
Documents:
Doc 1: "Elasticsearch is powerful"
Doc 2: "Elasticsearch is fast"
Doc 3: "Fast search engine"

Inverted Index:
elasticsearch → [Doc1, Doc2]
is → [Doc1, Doc2]
powerful → [Doc1]
fast → [Doc2, Doc3]
search → [Doc3]
engine → [Doc3]

Query: "fast"
  1. Look up "fast" in index → [Doc2, Doc3]
  2. Return matches instantly
```

</details>

**Analysis process** (converts text → searchable terms):

<details>
<summary>Click to view code</summary>

```
Input: "The Quick Brown Fox"
    ↓
1. Tokenizer: ["The", "Quick", "Brown", "Fox"]
    ↓
2. Token Filters:
   - Lowercase: ["the", "quick", "brown", "fox"]
   - Remove stopwords: ["quick", "brown", "fox"]
    ↓
3. Store in inverted index:
   quick → [Doc]
   brown → [Doc]
   fox → [Doc]
```

</details>

---

## Indexing (Writes)

### Indexing Flow

<details>
<summary>Click to view code</summary>

```
Client:
  PUT /products/_doc/12345
  { "title": "Laptop", "price": 999 }
       ↓
Primary Shard:
  1. Parse JSON
  2. Analyze fields
  3. Build inverted index
  4. Store in memory buffer (refresh)
       ↓
Replica Shards:
  Receive and index same document
       ↓
Acknowledgment:
  Return success to client
```

</details>

### Indexing Settings

<details>
<summary>Click to view code (python)</summary>

```python
# Bulk indexing for high throughput
from elasticsearch import Elasticsearch

es = Elasticsearch(['localhost:9200'])

# Bulk index documents
actions = [
    {"index": {"_index": "products", "_id": i}},
    {"title": f"Product {i}", "price": i * 10}
    for i in range(10000)
]

from elasticsearch.helpers import bulk
bulk(es, actions, chunk_size=500)
```

</details>

**Refresh and flush:**

<details>
<summary>Click to view code</summary>

```
Refresh (every 1 second by default):
  - Flushes buffer to Lucene segment
  - Makes documents searchable
  - No durability guarantee

Flush:
  - Commits Lucene segment to disk
  - Updates transaction log
  - Ensures durability

Optimization:
  - Bulk indexing: Increase refresh_interval during bulk operations
  - Disable replicas: Index to primary only, then enable replicas
  - Bulk size: 5-15MB chunks for optimal performance
```

</details>

---

## Searching (Reads)

### Query Types

**Match Query** (full-text, analyzed):
<details>
<summary>Click to view code (json)</summary>

```json
{
  "query": {
    "match": {
      "title": "fast search"
    }
  }
}
// Matches: "fast", "search", "faster", "searched" (due to analysis)
```

</details>

**Term Query** (exact match, not analyzed):
<details>
<summary>Click to view code (json)</summary>

```json
{
  "query": {
    "term": {
      "status": "active"
    }
  }
}
// Exact match only
```

</details>

**Bool Query** (combine conditions):
<details>
<summary>Click to view code (json)</summary>

```json
{
  "query": {
    "bool": {
      "must": [
        {"match": {"title": "laptop"}},
        {"range": {"price": {"gte": 500, "lte": 1500}}}
      ],
      "filter": [
        {"term": {"in_stock": true}}
      ],
      "should": [
        {"match": {"tags": "gaming"}}
      ]
    }
  }
}
```

</details>

**Filter Context** (cached, fast):
<details>
<summary>Click to view code (json)</summary>

```json
{
  "query": {
    "bool": {
      "filter": [
        {"term": {"status": "active"}},
        {"range": {"created_at": {"gte": "2024-01-01"}}}
      ]
    }
  }
}
// Filters are cached and don't affect scoring
```

</details>

---

### Search Execution Flow

<details>
<summary>Click to view code</summary>

```
Query:
  bool {
    must: [match: "laptop", range: price 500-1500],
    filter: [term: in_stock=true]
  }
       ↓
1. Query Phase (find matching shards):
   - All shards execute query
   - Return top 10 doc IDs + scores
   - Coordinator gathers results
       ↓
2. Fetch Phase (get documents):
   - Coordinator fetches full documents
   - Apply sorting/pagination
   - Return to client
```

</details>

**Query DSL Examples:**

<details>
<summary>Click to view code (python)</summary>

```python
# Python client
es = Elasticsearch(['localhost:9200'])

# Full-text search
results = es.search(index="products", body={
    "query": {
        "match": {
            "title": "laptop"
        }
    },
    "size": 10
})

# Filter + aggregation
results = es.search(index="products", body={
    "query": {
        "bool": {
            "filter": [
                {"term": {"in_stock": True}},
                {"range": {"price": {"gte": 500}}}
            ]
        }
    },
    "aggs": {
        "avg_price": {"avg": {"field": "price"}},
        "categories": {
            "terms": {"field": "category", "size": 10}
        }
    }
})
```

</details>

---

## Aggregations (Analytics)

**Aggregations**: Group and analyze data without searching

<details>
<summary>Click to view code (json)</summary>

```json
{
  "aggs": {
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          {"to": 500},
          {"from": 500, "to": 1000},
          {"from": 1000}
        ]
      }
    },
    "by_category": {
      "terms": {
        "field": "category",
        "size": 10
      },
      "aggs": {
        "avg_price": {"avg": {"field": "price"}}
      }
    }
  }
}
```

</details>

**Common aggregation types:**

| Aggregation | Use Case | Example |
|-------------|----------|---------|
| **terms** | Count occurrences | Top 10 products by sales |
| **avg/sum/max/min** | Statistical | Average price per category |
| **date_histogram** | Time-series | Sales per day |
| **percentiles** | Distribution | P99 latency |
| **cardinality** | Unique count | Unique users |

---

## Performance Optimization

### Indexing Optimization

<details>
<summary>Click to view code (properties)</summary>

```properties
# During bulk indexing
index.refresh_interval=-1          # Disable auto-refresh
index.number_of_replicas=0         # No replication

# Bulk indexing settings
bootstrap.mlockall=true            # Lock memory (no swap)
indices.memory.index_buffer_size=30%  # Larger buffer

# Rebalance shards after bulk indexing
index.number_of_replicas=2

# Force merge segments
POST /index/_forcemerge?max_num_segments=1
```

</details>

### Search Optimization

<details>
<summary>Click to view code (properties)</summary>

```properties
# Field caching for frequent filters
index.fielddata.cache.size=20%

# Shard allocation awareness
cluster.routing.allocation.awareness.attributes=zone
node.attr.zone=us-west-1a

# Query cache (filters)
index.queries.cache.is_enabled=true

# Request cache (aggregations)
indices.requests.cache.size=1%
```

</details>

### Resource Configuration

<details>
<summary>Click to view code (properties)</summary>

```properties
# Memory allocation
-Xms8g -Xmx8g  # Heap size (half of total system RAM)

# File descriptors
ulimit -n 65535

# Virtual memory
vm.max_map_count=262144

# Network
http.port=9200
transport.port=9300
network.host=0.0.0.0
```

</details>

---

## Scalability & High Availability

### Cluster Architecture

**Small cluster** (1-10 nodes):
<details>
<summary>Click to view code</summary>

```
3 Master-eligible nodes
+ 5 Data nodes
= 8 total nodes
Handles: 1-10M docs/day
```

</details>

**Medium cluster** (10-50 nodes):
<details>
<summary>Click to view code</summary>

```
3-5 Master nodes
+ 20-40 Data nodes
+ Coordinator nodes (optional)
Handles: 100M-1B docs/day
```

</details>

**Large cluster** (50+ nodes):
<details>
<summary>Click to view code</summary>

```
5 Master nodes (separate from data)
+ 100+ Data nodes
+ 10+ Coordinator nodes
+ Dedicated ingest nodes (optional)
Handles: 1B+ docs/day
```

</details>

### Replica Strategy

<details>
<summary>Click to view code</summary>

```
Trade-off: Availability vs Resource Cost

0 Replicas:
  - Failure = data loss
  - Lowest cost
  - Fast indexing
  - Use for: Testing, non-critical data

1 Replica:
  - Failure = one node down, data preserved
  - Can lose one node
  - Balanced cost/availability
  - Use for: Production with SLA

2+ Replicas:
  - Failure = multiple nodes can go down
  - Higher cost (3x storage with 2 replicas)
  - Excellent read parallelism
  - Use for: Critical, high-traffic systems
```

</details>

### Cross-Cluster Replication

<details>
<summary>Click to view code</summary>

```
Primary Cluster (US-East):
  [Index A] → Replicates → Secondary Cluster (EU-West)
                              [Index A Mirror]

Use case: Geographic redundancy, disaster recovery

Configuration:
- CCR (Cross-Cluster Replication)
- Bidirectional replication for active-active
- One-way for active-passive DR
```

</details>

---

## Configuration Tuning

### Discovery and Cluster Formation

<details>
<summary>Click to view code (properties)</summary>

```properties
# Cluster name
cluster.name=my-cluster

# Master nodes
discovery.seed_hosts=["node1", "node2", "node3"]
cluster.initial_master_nodes=["node1", "node2", "node3"]

# Split-brain prevention
discovery.zen.minimum_master_nodes=2  # (N/2 + 1)

# Shard allocation
cluster.routing.allocation.enable=all
```

</details>

### Index Configuration

<details>
<summary>Click to view code (json)</summary>

```json
{
  "settings": {
    "number_of_shards": 10,
    "number_of_replicas": 2,
    "index.codec": "best_compression",
    "index.refresh_interval": "30s",
    "index.store.type": "niofs"
  }
}
```

</details>

### Shard Size Guidelines

<details>
<summary>Click to view code</summary>

```
Target shard size: 20-50 GB (per replica)

Calculation:
  Total index size: 1 TB
  Desired shard size: 30 GB
  Number of shards needed: 1TB / 30GB ≈ 34 shards

Too few shards:
  - Few parallel searches
  - Slow recovery
  - Unbalanced load

Too many shards:
  - Overhead from coordination
  - Slow recovery (many shards to rebuild)
  - Per-shard memory overhead
```

</details>

---

## Use Cases

### 1. Full-Text Search

<details>
<summary>Click to view code</summary>

```
E-commerce search:
  - Product catalog search
  - Faceted search (filter by category, price range)
  - Autocomplete/typeahead
  - Search-as-you-type
```

</details>

### 2. Logging and Metrics (ELK Stack)

<details>
<summary>Click to view code</summary>

```
Elasticsearch + Logstash + Kibana:
  - Collect logs from servers
  - Parse and enrich with Logstash
  - Index in Elasticsearch
  - Visualize in Kibana

Benefits:
  - Real-time log analysis
  - Pattern detection
  - Performance monitoring
```

</details>

### 3. Analytics and BI

<details>
<summary>Click to view code</summary>

```
Time-series analytics:
  - Event data (clicks, page views, purchases)
  - Metrics (CPU, memory, request latency)
  - Aggregations for dashboards
  - Ad-hoc analysis
```

</details>

### 4. Geospatial Search

<details>
<summary>Click to view code</summary>

```
Map-based services:
  - "Find restaurants near me"
  - Ride-sharing (nearby drivers)
  - Delivery services (nearest warehouse)

Geo query types:
  - geo_distance: Radius search
  - geo_bounding_box: Area search
  - geo_polygon: Complex boundaries
```

</details>

---

## Interview Questions & Answers

### Q1: Design a search system for an e-commerce platform (10M products, 10K QPS)

**Requirements:**
- Fast product search (< 100ms)
- Faceted search (filter by category, price, ratings)
- Autocomplete suggestions
- 99.99% uptime

**Solution Architecture:**

<details>
<summary>Click to view code</summary>

```
Cluster Setup:
  - 3 Master nodes (t3.medium)
  - 20 Data nodes (r5.4xlarge: 128GB RAM, high memory)
  - Coordinator nodes (optional, for high load)

Index Design:
  "products" index
    - Shards: 20 (1 per data node for parallelism)
    - Replicas: 2 (3x total copies for HA)
    - Mapping:
      {
        "product_id": keyword,
        "title": text (analyzer: standard + stemmer),
        "description": text,
        "category": keyword,
        "price": float,
        "rating": float,
        "in_stock": boolean,
        "created_at": date
      }
```

</details>

**Query optimization:**

<details>
<summary>Click to view code (python)</summary>

```python
# Faceted search with aggregations
query = {
    "query": {
        "bool": {
            "must": [
                {"match": {"title": user_input}}
            ],
            "filter": [
                {"term": {"category": selected_category}},
                {"range": {"price": {"gte": min_price, "lte": max_price}}},
                {"term": {"in_stock": True}}
            ]
        }
    },
    "aggs": {
        "categories": {"terms": {"field": "category", "size": 50}},
        "price_ranges": {
            "range": {
                "field": "price",
                "ranges": [{"to": 100}, {"from": 100, "to": 500}, ...]
            }
        },
        "ratings": {"terms": {"field": "rating", "size": 5}}
    },
    "size": 20,
    "from": 0
}
```

</details>

**Autocomplete:**

<details>
<summary>Click to view code (json)</summary>

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "autocomplete_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "stop", "snowball"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "product_title": {
        "type": "text",
        "analyzer": "autocomplete_analyzer",
        "fields": {
          "suggest": {
            "type": "completion"
          }
        }
      }
    }
  }
}

// Query autocomplete
{
  "query": {
    "match_phrase_prefix": {
      "product_title": "lapt"
    }
  },
  "size": 10
}
```

</details>

**Performance expectations:**

| Operation | Latency | Notes |
|-----------|---------|-------|
| Search | 50-100ms | P99 with 20 shards parallel |
| Faceted search | 100-200ms | Aggregations take longer |
| Autocomplete | 10-50ms | Completion suggester cached |

---

### Q2: Cluster goes down. How to recover without data loss?

**Answer:**

**Backup strategy:**

<details>
<summary>Click to view code (properties)</summary>

```properties
# Snapshot repository (S3)
PUT /_snapshot/s3-backup
{
  "type": "s3",
  "settings": {
    "bucket": "my-es-backups",
    "region": "us-east-1"
  }
}

# Take snapshot daily
POST /_snapshot/s3-backup/snapshot-2024-01-05?wait_for_completion=true
```

</details>

**Recovery scenarios:**

| Failure | Impact | Recovery Time |
|---------|--------|---|
| **1 Data node fails** | No impact (replicas take over) | Automatic (seconds) |
| **Multiple nodes fail** | Replicas insufficient | Minutes (depends on replica count) |
| **Entire cluster down** | Data recoverable from snapshot | 30min-2hrs (restore from S3) |

**Recovery procedure:**

<details>
<summary>Click to view code (bash)</summary>

```bash
# 1. Restore cluster from backup
POST /_snapshot/s3-backup/snapshot-2024-01-05/_restore
{
  "indices": "products,users",
  "ignore_unavailable": true
}

# 2. Monitor recovery status
GET /_recovery

# 3. Verify data integrity
GET /products/_count

# 4. Resync replicas
PUT /products/_settings
{
  "index.number_of_replicas": 2
}
```

</details>

**Key takeaway**: "With 2+ replicas, node failure is automatic failover. For total cluster failure, restore from snapshots (RPO = 1 day if daily snapshots)."

---

### Q3: Search latency spike. How to diagnose?

**Answer:**

**Diagnosis checklist:**

<details>
<summary>Click to view code (bash)</summary>

```bash
# 1. Check cluster health
GET /_cluster/health

# 2. Check shard allocation
GET /_cat/shards?v

# 3. Check node stats (CPU, memory, GC)
GET /_nodes/stats

# 4. Check slowlog
GET /products/_settings?include_defaults=true | grep slowlog

# 5. Enable slowlog for 1 second queries
PUT /products/_settings
{
  "index.search.slowlog.threshold.query.warn": "1s"
}

# 6. Check pending tasks
GET /_cluster/pending_tasks

# 7. Monitor JVM GC
GET /_nodes/jvm/stats
```

</details>

**Common causes and fixes:**

| Problem | Cause | Fix |
|---------|-------|-----|
| **High query latency** | Large result set (slow fetch phase) | Reduce page size, use scroll API |
| **GC pauses** | Heap too full, frequent GC | Increase heap, optimize query |
| **Unbalanced shards** | Hot shards (too much traffic) | Rebalance shards, adjust routing |
| **Slow aggregations** | Too many buckets | Reduce aggregation cardinality |
| **Disk I/O bottleneck** | SSD at capacity | Add nodes, optimize refresh interval |

---

### Q4: Index size growing 10x in 3 months. How to optimize storage?

**Answer:**

**Root cause analysis:**

<details>
<summary>Click to view code (bash)</summary>

```bash
# Check index size
GET /_cat/indices?v&h=index,store.size,docs.count

# Calculate docs per GB
docs_per_gb = docs.count / (store.size / 1GB)
```

</details>

**Optimization strategies:**

1. **Compression:**
<details>
<summary>Click to view code (json)</summary>

```json
{
  "settings": {
    "index.codec": "best_compression"  // vs default
  }
}
```

</details>

2. **Disable unnecessary fields:**
<details>
<summary>Click to view code (json)</summary>

```json
{
  "mappings": {
    "properties": {
      "description": {
        "type": "text",
        "index": false  // Don't index, just store
      }
    }
  }
}
```

</details>

3. **Field type optimization:**
<details>
<summary>Click to view code</summary>

```
text field: 2x size of keyword field
nested objects: High overhead
Use keyword where full-text search not needed
```

</details>

4. **Index lifecycle management:**
<details>
<summary>Click to view code</summary>

```
Hot: Current month (full replicas, high refresh rate)
Warm: Last 3 months (fewer replicas, lower refresh rate)
Cold: Older data (minimal replicas, snapshot only)
Delete: > 1 year
```

</details>

**Expected improvements:**

<details>
<summary>Click to view code</summary>

```
Before optimization:
  1M docs = 10GB storage (10KB per doc average)

After compression + field optimization:
  1M docs = 5GB storage (50% reduction)

With tiering:
  1M docs = 3GB total (hot: 1GB, warm: 1.5GB, cold: 0.5GB)
```

</details>

---

### Q5: Designing Elasticsearch for real-time log aggregation (1M logs/sec)

**Answer:**

**Architecture:**

<details>
<summary>Click to view code</summary>

```
Log Sources (servers, apps)
       ↓
Logstash (parsing, enrichment)
       ↓
Elasticsearch Cluster (hot-warm-cold)
       ↓
Kibana (visualization)
```

</details>

**Cluster sizing:**

<details>
<summary>Click to view code</summary>

```
1M logs/sec × 1KB per log = 1GB/sec = 86TB/day

Storage requirement (7-day retention):
  86TB × 7 = 600TB raw
  With compression (50%): 300TB
  With 2 replicas: 900TB total

Hardware needed:
  - 30 nodes × 30TB each (r5.4xlarge with attached storage)
  - 3 dedicated master nodes
  - 5 coordinator nodes (distribute load)
```

</details>

**Index strategy:**

<details>
<summary>Click to view code</summary>

```
Daily rolling indices:
  logs-2024-01-05 (hot)
  logs-2024-01-04 (warm)
  logs-2024-01-03 (warm)
  logs-2024-01-02 (cold)
  logs-2024-01-01 (cold)

Settings per day:
  - Shards: 20 (distribute across data nodes)
  - Replicas: 1 initially, scale to 2 for HA
  - Refresh interval: 30-60s (batch writes)
  - Rollover when: 50GB or 24 hours
```

</details>

**Indexing optimization:**

<details>
<summary>Click to view code (python)</summary>

```python
# Bulk indexing with Logstash
output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    bulk_path => "/_bulk"
    bulk_size => 1000
    flush_interval => 5
    compression_level => "best"
  }
}
```

</details>

**Query optimization:**

<details>
<summary>Click to view code</summary>

```
Use time-range filter (fast):
  range: { @timestamp: { gte: "2024-01-05" } }

Avoid full-text search on all logs:
  Cost: O(n) scan of all documents
  Better: Filter by log level, service, then search

Use aggregations for metrics:
  Errors per service (terms aggregation)
  Response time distribution (percentiles)
```

</details>

---

## Elasticsearch vs Alternatives

| System | Throughput | Latency | Best For | Trade-off |
|--------|-----------|---------|----------|-----------|
| **Elasticsearch** | 1M+/sec | 10-100ms | Full-text, logs, analytics | Complex, resource-hungry |
| **Solr** | 100K/sec | 50-200ms | Enterprise search | Slower, Java-heavy |
| **OpenSearch** | 1M+/sec | 10-100ms | ES alternative (AWS native) | Fewer plugins |
| **Algolia** | 100K/sec | 1-10ms | Hosted search (SaaS) | High cost, limited customization |
| **Meilisearch** | 100K/sec | 1-50ms | Fast search UX | Less flexible |

---

## Best Practices

### Operational Best Practices

✓ **Always use replicas** (min 2) for production
✓ **Monitor JVM GC** (long pauses = latency spike)
✓ **Use dedicated master nodes** (separate from data)
✓ **Set ulimit -n 65535** (file descriptors)
✓ **Enable security** (X-Pack authentication)
✓ **Monitor disk space** (leave 20% free for merge operations)
✓ **Plan for growth** (add nodes before hitting limits)
✓ **Use snapshot/restore** (daily backups to S3/GCS)

### Query Best Practices

✓ **Filter before search** (cached and faster)
✓ **Use persistent queries** (for aggregations)
✓ **Pagination with search_after** (not from/size for large offsets)
✓ **Async search for long queries** (`async_search` API)
✓ **Batch requests** (`_msearch` instead of individual queries)

### Mapping Best Practices

✓ **Use keyword for exact match** (faster, smaller)
✓ **Use text only for full-text search** (analyzer overhead)
✓ **Set explicit mappings** (avoid field explosion)
✓ **Use ignore_above** (prevent oversized keywords)
✓ **Disable source for read-only indices** (save space)

---

## Disaster Recovery Strategy

### Single-Region Setup

| Scenario | Impact | Recovery |
|----------|--------|----------|
| **Single node failure** | Auto (replicas take over) | Seconds |
| **Multiple node failure** | Partial outage (if replicas insufficient) | Minutes (nodes rejoin) |
| **Cluster failure** | Complete outage | Restore from snapshot (30min-2hrs) |

**Mitigation**: Always use 2+ replicas in production

### Multi-Region Setup

<details>
<summary>Click to view code</summary>

```
Primary Cluster (US-East)
  [Logs Index]
       ↓ CCR
Secondary Cluster (EU-West)
  [Logs Index (read-only)]

Failover process:
  1. Stop CCR replication
  2. Promote secondary to read-write
  3. Update application to point to EU-West
  4. RPO: Depends on replication lag (usually < 1 sec)
```

</details>

---

## Summary & Key Takeaways

**Elasticsearch excels at:**
- ✓ Full-text search (sub-100ms on large datasets)
- ✓ Real-time log analytics (ELK stack)
- ✓ Time-series data (metrics, events)
- ✓ Flexible schema (dynamic mappings)
- ✓ High availability (replicas, automatic failover)

**Key challenges:**
- ✗ Operational complexity (cluster management)
- ✗ Resource intensive (memory, disk, CPU)
- ✗ Consistency trade-offs (eventual consistency)
- ✗ Learning curve (complex DSL, tuning)
- ✗ Cost at scale (large clusters needed for high volume)

**Critical design questions:**
1. What's my search latency target (ms)?
2. How much data must I retain (days/months)?
3. What's my query volume (QPS)?
4. Do I need full-text or exact-match search?
5. What's my availability SLA?
6. Can I afford downtime for rebalancing?
7. What's my budget for clusters (storage, compute)?

---

## Elasticsearch — Practical Usage Guide

System designs can involve a dizzying array of different technologies, concepts and patterns, but one technology stands out for search and retrieval: **Elasticsearch**. While most database systems are pretty good at search (e.g. Postgres with a full-text index is sufficient for many problems!), at a certain scale or level of sophistication you'll want a purpose-built system.

From an interview perspective, there are two angles:

1. **How to use Elasticsearch** — gives you a powerful tool for product architecture interviews
2. **How Elasticsearch works under the hood** — important for infra-heavy roles, especially at cloud companies

---

### Basic Concepts

The important concepts from a client perspective are **documents**, **indices**, **mappings**, and **fields**.

#### Documents

Documents are the individual units of data you're searching over. Think of them as JSON objects:

```json
{
  "id": "XYZ123",
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "price": 10.99,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### Indices

An index is a collection of documents. Each document is associated with a unique ID and a set of fields. Think of an index as a database table. Searches happen against indices and return matching document results.

> **Note:** This terminology overloads the general term "index" used for auxiliary data structures that make searches faster.

#### Mappings and Fields

A mapping is the **schema** of the index. It defines the fields, their data types, and how they are processed and indexed.

```json
{
  "properties": {
    "id": { "type": "keyword" },
    "title": { "type": "text" },
    "author": { "type": "text" },
    "price": { "type": "float" },
    "createdAt": { "type": "date" }
  }
}
```

**Key distinctions:**

- `keyword` — treated as a whole value (think: hash table lookup)
- `text` — tokenized for full-text search (think: inverted index)

**Performance implication:** If you include lots of fields in your mapping that aren't used in search, this increases memory overhead. If a User object has 10 fields but you only search by 2, mapping all 10 wastes memory.

---

### Basic Operations

Elasticsearch has a clean REST API for all operations.

#### Create an Index

```
PUT /books
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1
  }
}
```

#### Set a Mapping

```
PUT /books/_mapping
{
  "properties": {
    "title": { "type": "text" },
    "author": { "type": "keyword" },
    "description": { "type": "text" },
    "price": { "type": "float" },
    "publish_date": { "type": "date" },
    "categories": { "type": "keyword" },
    "reviews": {
      "type": "nested",
      "properties": {
        "user": { "type": "keyword" },
        "rating": { "type": "integer" },
        "comment": { "type": "text" }
      }
    }
  }
}
```

> **Nested vs separate index:** If reviews are infrequently updated and frequently queried, nest them within book documents. Otherwise, create a separate index. This is analogous to the normalization/denormalization tradeoff in SQL databases.

#### Add Documents

```
POST /books/_doc
{
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "description": "A novel about the American Dream in the Jazz Age",
  "price": 9.99,
  "publish_date": "1925-04-10",
  "categories": ["Classic", "Fiction"],
  "reviews": [
    { "user": "reader1", "rating": 5, "comment": "A masterpiece!" },
    { "user": "reader2", "rating": 4, "comment": "Beautifully written, but a bit sad." }
  ]
}
```

Response includes a `_version` field used for atomic updates:

```json
{
  "_index": "books",
  "_id": "kLEHMYkBq7V9x4qGJOnh",
  "_version": 1,
  "result": "created",
  "_shards": { "total": 2, "successful": 1, "failed": 0 }
}
```

#### Updating Documents

**Full replacement:**

```
PUT /books/_doc/kLEHMYkBq7V9x4qGJOnh
{ ... full document ... }
```

**Optimistic concurrency control** — only update if version matches:

```
PUT /books/_doc/kLEHMYkBq7V9x4qGJOnh?version=1
{ ... }
```

**Partial update:**

```
POST /books/_update/kLEHMYkBq7V9x4qGJOnh
{
  "doc": { "price": 14.99 }
}
```

---

### Search

#### Basic Match Query

```
GET /books/_search
{
  "query": {
    "match": { "title": "Great" }
  }
}
```

#### Boolean Query (AND conditions)

```
GET /books/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "Great" } },
        { "range": { "price": { "lte": 15 } } }
      ]
    }
  }
}
```

#### Nested Field Search

```
GET /books/_search
{
  "query": {
    "nested": {
      "path": "reviews",
      "query": {
        "bool": {
          "must": [
            { "match": { "reviews.comment": "excellent" } },
            { "range": { "reviews.rating": { "gte": 4 } } }
          ]
        }
      }
    }
  }
}
```

Results include document IDs, relevance scores (`_score`), and source documents.

---

### Geospatial Search

Elasticsearch supports two primary geospatial field types:

| Type | Use Case |
|---|---|
| `geo_point` | Single lat/lon pair — restaurant locations, user check-ins |
| `geo_shape` | Arbitrary geometries — delivery zones, city boundaries |

**Mapping:**

```json
{
  "properties": {
    "name": { "type": "text" },
    "location": { "type": "geo_point" },
    "delivery_zone": { "type": "geo_shape" }
  }
}
```

**Distance query:**

```
GET /restaurants/_search
{
  "query": {
    "geo_distance": {
      "distance": "5km",
      "location": { "lat": 40.7128, "lon": -74.0060 }
    }
  }
}
```

Under the hood, Elasticsearch uses **geohashes**, **BKD trees** (variant of k-d trees optimized for block storage), and **R-tree-like structures** for fast geospatial queries across millions of documents.

---

### Sorting

#### Basic Sort

```
GET /books/_search
{
  "sort": [
    { "price": "asc" },
    { "publish_date": "desc" }
  ],
  "query": { "match_all": {} }
}
```

#### Script-Based Sort

```
GET /books/_search
{
  "sort": [{
    "_script": {
      "type": "number",
      "script": { "source": "doc['price'].value * 0.9" },
      "order": "asc"
    }
  }],
  "query": { "match_all": {} }
}
```

#### Nested Field Sort

```
GET /books/_search
{
  "sort": [{
    "reviews.rating": {
      "order": "desc",
      "mode": "max",
      "nested": { "path": "reviews" }
    }
  }],
  "query": { "match_all": {} }
}
```

#### Relevance-Based Sorting

Without a specified sort, Elasticsearch sorts by relevance score (`_score`). The default scoring algorithm is closely related to **TF-IDF** (Term Frequency-Inverse Document Frequency).

---

### Pagination

#### From/Size Pagination

```
GET /my_index/_search
{
  "from": 0,
  "size": 10,
  "query": { "match": { "title": "elasticsearch" } }
}
```

**Limitation:** Becomes inefficient beyond ~10,000 results — the cluster must retrieve and sort all preceding documents on each request.

#### Search After (Keyset Pagination)

More efficient for deep pagination. Uses sort values of the last result as the starting point:

```
GET /my_index/_search
{
  "size": 10,
  "query": { "match": { "title": "elasticsearch" } },
  "sort": [
    { "date": "desc" },
    { "_id": "desc" }
  ],
  "search_after": [1463538857, "654323"]
}
```

**Pros:** Efficient for deep pagination, no duplicates
**Cons:** Forward-only, requires client-side state, may miss prior-page updates

#### Cursors (Point in Time / PIT)

Provides a **consistent snapshot** of data across paginated requests:

```
POST /my_index/_pit?keep_alive=1m          # Create PIT → returns PIT ID

GET /_search                                # Use PIT in search
{
  "size": 10,
  "pit": { "id": "46To...", "keep_alive": "1m" },
  "sort": [{ "_score": "desc" }, { "_id": "asc" }],
  "search_after": [1.0, "1234"]
}

DELETE /_pit                                # Close PIT when done
{ "id": "46To..." }
```

---

### How Elasticsearch Works Under the Hood

Elasticsearch = high-level orchestration framework for **Apache Lucene** (the optimized low-level search library). Elasticsearch handles distributed systems (cluster coordination, APIs, aggregations, real-time capabilities) while Lucene handles the "heart" of search.

#### Node Types

| Node Type | Responsibility |
|---|---|
| **Master** | Cluster coordination — add/remove nodes, create/delete indices |
| **Data** | Store data and execute search operations |
| **Coordinating** | Receive client requests, distribute to appropriate nodes, merge results |
| **Ingest** | Data transformation and preparation for indexing |
| **Machine Learning** | ML tasks |

Each instance can be multiple types. In sophisticated deployments, dedicated hosts per type (e.g. CPU-heavy ingest nodes, memory-heavy data nodes).

**Cluster startup:** Seed nodes (master-eligible) perform leader election. Only one active master at a time; others on standby.

#### Data Nodes — The Search Engine

Data nodes separate raw `_source` data from **Lucene indexes** used in search. Requests proceed in two phases:

1. **Query phase** — identify relevant documents using optimized index structures
2. **Fetch phase** — (optionally) pull document IDs from nodes

**Hierarchy:** Index → Shards → Lucene Indexes → Lucene Segments

- **Shards** split data across hosts for parallel search
- **Replicas** provide HA and increased throughput (X TPS × Y replicas)
- Elasticsearch shards are 1:1 with Lucene indexes

#### Lucene Segments — Immutable Architecture

Segments are **immutable** containers of indexed data.

| Operation | How It Works |
|---|---|
| **Insert** | Added to buffer, flushed as a new segment |
| **Delete** | Segment maintains a deleted-IDs set; cleaned up on merge |
| **Update** | Soft-delete old document + insert new one; cleaned up on merge |
| **Merge** | Multiple segments combined into one, deleted docs cleaned up |

**Benefits of immutability:**
- Fast writes (no modification of existing segments)
- Safe caching (no consistency worries)
- Simplified concurrency (data doesn't change mid-query)
- Easier crash recovery
- Better compression
- Faster searches

> **Tradeoff:** Updates have worse performance than inserts due to soft-deletion bookkeeping. This is why Elasticsearch isn't ideal for rapidly updating data.

#### Inverted Index

The heart of Lucene. Maps content (words, numbers) to document locations.

**Example:** The word "lazy" maps to documents #12 and #53. Instead of scanning all 1 billion documents (O(n)), look up the inverted index for O(1) retrieval.

#### Doc Values

Columnar, contiguous representation of a single field across all documents in a segment. Used for **sorting** and **aggregations**.

- Inverted index → "which documents match?"
- Doc values → "what are the values for sorting/aggregation?"

#### Coordinating Nodes — Query Planning

The query planner determines the most efficient execution strategy by keeping statistics on field types, keyword popularity, and document lengths.

**Example:** Searching for "bill nye" — "bill" has millions of entries, "nye" has hundreds. The planner starts with the smaller set ("nye") to minimize work.

---

### Using Elasticsearch in Your Interview

**When to use it:**
- Complex search requirements (full-text, faceting, ranking, geospatial)
- Read-heavy workloads at scale
- Typically attached via **Change Data Capture (CDC)** to an authoritative store (Postgres, DynamoDB)

**When NOT to use it:**
- As your primary database (consistency/durability issues)
- Write-heavy systems (rapidly updating fields like like-counts)
- Small datasets (< 100k documents) — a simple DB query may suffice
- When you can't tolerate eventual consistency

**Key principles:**
- Denormalize data for efficient search queries
- Keep Elasticsearch in sync with underlying data (drift is a common bug source)
- Aim for results from 1-2 queries

### Lessons from Elasticsearch for System Design

1. **Immutability** — enhances caching, compression, and eliminates synchronization issues
2. **Separation of concerns** — query execution (coordinating nodes) vs storage (data nodes) can be optimized independently
3. **Indexing strategies** — inverted indexes for search, doc values for sorting/aggregation; structure data for common query patterns
4. **Distributed trade-offs** — scalability and fault tolerance come with consistency complexity (CAP theorem)
5. **Efficient data structures** — skip lists, finite state transducers, BKD trees show how tailored structures dramatically improve specific use cases

---

## Additional Interview Questions & Answers

### Q6: What is an inverted index and why is it crucial for Elasticsearch?

**Answer:** An inverted index is a data structure that maps content (words, tokens) to the documents that contain them — the reverse of a normal index that maps documents to their content.

**How it works:**
1. During indexing, each document's text fields are **analyzed** (tokenized, lowercased, stemmed, etc.)
2. Each unique token is stored as a key, with a posting list of document IDs as the value
3. At search time, the query is analyzed the same way, and the matching posting lists are retrieved and intersected

**Example:**
```
"lazy" → [doc #12, doc #53]
"fox"  → [doc #12, doc #99, doc #150]
```

Searching for "lazy fox" intersects both lists → doc #12.

**Why it's crucial:**
- Turns O(n) full-text scan into O(1) lookup per term
- Enables boolean queries (AND/OR/NOT) via set operations on posting lists
- Supports phrase queries, proximity searches, and fuzzy matching
- Each Lucene segment maintains its own inverted index

---

### Q7: Explain the difference between `keyword` and `text` field types. When would you use each?

**Answer:**

| Aspect | `text` | `keyword` |
|---|---|---|
| **Analysis** | Tokenized, lowercased, stemmed | Stored as-is, no analysis |
| **Use case** | Full-text search ("find books about cats") | Exact match, filtering, sorting, aggregations |
| **Index structure** | Inverted index with analyzed tokens | Inverted index with exact values |
| **Examples** | Book descriptions, comments, articles | IDs, email addresses, status codes, categories |

**Common pattern:** Use both via multi-fields:
```json
{
  "title": {
    "type": "text",
    "fields": {
      "raw": { "type": "keyword" }
    }
  }
}
```
This lets you full-text search on `title` and sort/aggregate on `title.raw`.

---

### Q8: How does Elasticsearch handle consistency? What are the implications?

**Answer:** Elasticsearch is **eventually consistent** by design.

**Write path:**
1. Document is written to the primary shard's **translog** (write-ahead log)
2. Document is buffered in memory
3. Every ~1 second (configurable `refresh_interval`), the buffer is flushed to a new Lucene segment — only then is it **searchable**
4. Periodically, segments are fsynced to disk

**Implications:**
- There's a **~1 second delay** between writing a document and being able to search for it
- `GET /index/_doc/{id}` is **real-time** (reads from translog), but `_search` is not
- You can force a refresh with `POST /index/_refresh` but this is expensive at scale
- Replica synchronization adds further delay

**Interview tip:** Always acknowledge this gap. If the user writes a review and immediately searches for it, they might not see it. Solutions include:
- Read-your-own-writes at the application layer
- Using the `?refresh=wait_for` parameter (with caution)
- Returning the written document directly without searching

---

### Q9: What is the difference between `from/size`, `search_after`, and PIT-based pagination?

**Answer:**

| Method | Mechanism | Deep Pagination | Consistency | Random Access |
|---|---|---|---|---|
| **from/size** | Skip + limit | Poor (O(from+size) per request) | None | Yes |
| **search_after** | Keyset after last result's sort values | Good (only fetches next page) | None (data can shift) | No (forward-only) |
| **PIT + search_after** | Snapshot + keyset | Good | Yes (frozen view) | No (forward-only) |

**When to use each:**
- **from/size** — simple UIs with < 10k results, where users rarely go past page 5
- **search_after** — infinite scroll, large result sets, acceptable if underlying data shifts
- **PIT + search_after** — export/ETL jobs, audit trails, or any case requiring a consistent snapshot

---

### Q10: How do shards work and how do you decide the number of shards?

**Answer:**

**How shards work:**
- An index is split into N shards (set at index creation, hard to change later)
- Each shard is a complete Lucene index
- Documents are routed to shards via `hash(routing_key) % num_shards` (default routing key is `_id`)
- Searches query all shards in parallel; coordinating node merges results

**Sizing guidelines:**

| Factor | Recommendation |
|---|---|
| **Shard size** | 10–50 GB per shard (sweet spot) |
| **Shard count per node** | ~20 shards per GB of heap |
| **Too few shards** | Can't parallelize, single node bottleneck |
| **Too many shards** | Overhead per shard (memory, file handles, thread pools), slow cluster state updates |

**Practical approach:**
1. Estimate total data size
2. Target 20–40 GB per shard
3. Ensure shard count allows distribution across nodes
4. For time-series data, use **index-per-time-period** (daily/weekly) with ILM policies

---

### Q11: How would you keep Elasticsearch in sync with a primary database?

**Answer:** The standard approach is **Change Data Capture (CDC)**:

```
Primary DB → CDC (e.g., Debezium) → Message Queue (Kafka) → ES Consumer → Elasticsearch
```

**Options ranked by reliability:**

| Approach | Pros | Cons |
|---|---|---|
| **CDC + Kafka** | Reliable, ordered, replayable | Operational complexity |
| **Dual writes** | Simple | Risk of inconsistency if one write fails |
| **Application-level events** | Flexible | Tight coupling, easy to miss updates |
| **Periodic batch sync** | Simple, self-healing | Stale data between syncs |

**Handling drift:**
- Periodic **reconciliation jobs** compare DB and ES counts/checksums
- Use **version fields** or timestamps to detect and fix inconsistencies
- Implement **dead letter queues** for failed indexing attempts

**Interview tip:** Always mention that Elasticsearch should NOT be the source of truth. The primary database is authoritative; ES is a read-optimized projection.

---

### Q12: Explain TF-IDF and how Elasticsearch uses it for relevance scoring.

**Answer:**

**TF-IDF** = Term Frequency × Inverse Document Frequency

| Component | Formula | Meaning |
|---|---|---|
| **TF** | `count(term in doc) / total terms in doc` | How often the term appears in this document |
| **IDF** | `log(total docs / docs containing term)` | How rare the term is across all documents |
| **TF-IDF** | `TF × IDF` | Terms that are frequent in a document but rare overall score highest |

**Example:** Searching for "elasticsearch" across 1M documents:
- A doc mentioning "elasticsearch" 10 times scores high TF
- If only 1000 docs mention "elasticsearch", IDF is high
- A doc mentioning "the" 50 times has high TF but very low IDF (common word)

**Elasticsearch specifics:**
- Modern versions use **BM25** (an evolution of TF-IDF) as the default
- BM25 adds **saturation** (diminishing returns for repeated terms) and **document length normalization**
- Scores can be customized via `function_score`, `boost`, or custom similarity plugins

---

### Q13: What are the main differences between Elasticsearch and a relational database for search?

**Answer:**

| Aspect | Elasticsearch | Relational DB (e.g., Postgres) |
|---|---|---|
| **Data model** | Denormalized documents (JSON) | Normalized tables with relations |
| **Search** | Built-in full-text, fuzzy, geo, semantic | Full-text possible but bolt-on (tsvector) |
| **Scoring/Ranking** | Native relevance scoring (BM25) | Manual implementation |
| **Joins** | Expensive/limited (nested, parent-child) | Native and optimized |
| **Consistency** | Eventual | Strong (ACID) |
| **Write performance** | Moderate (immutable segments, merges) | Good (in-place updates) |
| **Aggregations** | Very fast (doc values, columnar) | Slower at scale (row-oriented) |
| **Schema** | Flexible (dynamic mapping) | Rigid (migrations) |

**Rule of thumb:** Use a relational DB as your source of truth. Add Elasticsearch when you need full-text search, complex filtering/faceting, or relevance ranking at scale that your DB can't handle efficiently.

---

### Q14: How does Elasticsearch handle node failures and data recovery?

**Answer:**

**Detection:**
- Nodes send heartbeats to the master node
- If a node misses heartbeats for a configurable timeout, the master marks it as failed

**Recovery — Data node failure:**
1. Master identifies which shards were on the failed node
2. For shards that have replicas on other nodes, a replica is **promoted to primary**
3. New replicas are allocated to other nodes to restore the replication factor
4. The new replicas are built by **copying data from the primary shard**

**Recovery — Master node failure:**
1. Master-eligible nodes detect the master is gone
2. A new master is **elected** from the remaining master-eligible nodes
3. The new master rebuilds the cluster state

**Split-brain prevention:**
- Elasticsearch requires a **quorum** of master-eligible nodes to elect a master
- The `discovery.zen.minimum_master_nodes` setting (or automatic in 7.x+) prevents two halves of a cluster from independently electing masters

**Data durability:**
- The **translog** (write-ahead log) ensures that acknowledged writes survive node restarts
- On recovery, unfinished operations are replayed from the translog

---

### Q15: Design a search system for a food delivery app (like Uber Eats / DoorDash). What role does Elasticsearch play?

**Answer:**

**Requirements:** Search restaurants by name, cuisine, location, rating, delivery time, price range.

**Architecture:**

```
User → API Gateway → Search Service → Elasticsearch
                                    ↑
Restaurant DB → CDC (Debezium) → Kafka → ES Indexer
```

**Elasticsearch index mapping:**

```json
{
  "properties": {
    "name": { "type": "text" },
    "cuisine": { "type": "keyword" },
    "location": { "type": "geo_point" },
    "rating": { "type": "float" },
    "avg_delivery_time_min": { "type": "integer" },
    "price_range": { "type": "keyword" },
    "is_open": { "type": "boolean" },
    "menu_items": {
      "type": "nested",
      "properties": {
        "name": { "type": "text" },
        "price": { "type": "float" }
      }
    }
  }
}
```

**Example query** — "Pizza near me, rating > 4, within 3km":

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "name": "pizza" } },
        { "range": { "rating": { "gte": 4.0 } } },
        { "geo_distance": { "distance": "3km", "location": { "lat": 40.71, "lon": -74.00 } } },
        { "term": { "is_open": true } }
      ]
    }
  },
  "sort": [
    { "_geo_distance": { "location": { "lat": 40.71, "lon": -74.00 }, "order": "asc" } },
    { "rating": "desc" }
  ]
}
```

**Key design decisions:**
- **Denormalize** restaurant + menu data into one index for single-query results
- Use **CDC** to keep ES in sync with the restaurant database
- `is_open` updated via a lightweight scheduled job (not full CDC)
- **Hot key mitigation** — popular restaurants cached at the application layer
- **Pagination** — `search_after` for infinite scroll

---

### References

- [Full Text Search over Postgres: Elasticsearch vs. Alternatives](https://www.elastic.co/)
- [Exploring Apache Lucene - Part 1: The Index](https://www.lucenetutorial.com/)
- [BKD Trees, Used in Elasticsearch](https://users.cs.duke.edu/~pankaj/publications/papers/bkd-sstd.pdf)
