# Database Tradeoffs

## SQL vs NoSQL

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

## Common Databases: When to Use What

| DB | Model | Strengths | Best For | Watchouts |
|----|-------|-----------|----------|-----------|
| **DynamoDB** | Managed key-value/document | Serverless, predictable latency, auto-scaling, TTLs | Massive scale key-value lookups, bursty traffic, IoT/session/user settings | Hot partitions cost $$, limited query patterns, single-table design learning curve |
| **Cassandra** | Wide-column (AP) | Linear write scaling, multi-region friendly, tunable consistency | Write-heavy time-series/logs/metrics, large append-only datasets | Eventual consistency by default, partition-key centric modeling, tombstone/GC tuning |
| **PostgreSQL** | Relational | Strong ACID, rich SQL/JSONB, extensions (PostGIS/FDW), mature tooling | OLTP with complex queries/joins, moderate scale analytics, transactional workloads | Vertical limits; sharding/replica mgmt needed at very high scale; tune vacuum/autovacuum |
| **MySQL** | Relational | Battle-tested, easy ops, good replication, wide ecosystem | Simpler OLTP, LAMP stacks, read-heavy with replicas | Manual sharding at scale, fewer advanced SQL features vs Postgres, replica lag considerations |
| **MongoDB** | Document | Flexible schema, rich queries and indexes, good developer velocity | Evolving schemas (content/user profiles), nested documents, moderate real-time reads | Data integrity relies on schema discipline; multi-doc transactions newer; large/hot docs hurt |
| **Neo4j** | Graph | Native graph traversals, expressive Cypher queries | Highly connected data (social, fraud rings, recommendations, network/topology) | Not optimized for wide OLTP; different scaling model; specialized skill set/licensing |
| **Other quick picks** | | Redis: ultra-fast cache/leaderboards; Snowflake/BigQuery: analytics; Elasticsearch/OpenSearch: search/logs | Use per specialized need | Each adds infra/ops cost; keep surface area small |

**How to decide quickly:** Start with PostgreSQL or MySQL for most OLTP apps; pick DynamoDB/Cassandra when horizontal write scaling and simple access patterns dominate; choose MongoDB for flexible schemas without heavy joins; reach for graph (Neo4j) only when relationships are the core query.

---

## Geospatial/Location Query Tradeoffs

| Solution | Technology Stack | Strengths | Best For | Watchouts |
|----------|------------------|-----------|----------|-----------|
| **PostgreSQL + PostGIS** | SQL + Spatial Extension | Powerful spatial functions (within, distance, nearest); supports complex geometries (polygons, multipolygons); ACID transactions; excellent for analytics | Ride-sharing (nearby drivers), location filtering with complex queries, geographic analytics, multi-criteria location searches | Scales vertically; sharding complexity increases; slower on massive datasets; slower than specialized geo DBs for simple queries |
| **Redis Geo Commands** | In-memory key-value with geo module | Ultra-fast lookups (O(log N)); perfect for leaderboards/nearby lists; built-in sorting by distance; simple radius/bbox queries | Real-time "nearby" queries (food delivery partners, rideshare), leaderboards with location, sessions with geo data | Limited query complexity; no persistence (need RDB/AOF); doesn't handle complex polygons; re-indexes required for updates; memory-intensive |
| **MongoDB + Geospatial Indexes** | Document DB with 2dsphere/2d indexes | Flexible schema with geo data; supports complex geometries (multipoint, polygon); good scaling via sharding; TTL indexes for sessions | Location-based social features (check-ins), user discovery within region, delivery zone filtering with flexible data model | Slower than Redis for simple queries; index memory overhead; aggregation pipeline for complex geo + filters can be expensive; 2dsphere slower than 2d for simple radius |
| **Elasticsearch/OpenSearch** | Search engine with geo plugin | Fast range/radius searches; excellent for combining location + full-text search (e.g., "restaurants near me"); aggregations by geo grid/distance | Location-based search (nearby restaurants), autocomplete with geo filtering, geo-bucketing analytics | Not ideal for pure location queries (overkill); writes slower than reads; not ACID; large memory footprint; indexing cost high |
| **DynamoDB + Geo Partitioning** | Managed NoSQL with custom sharding | Serverless, predictable latency, auto-scaling; good for simple location lookups with partition key design | Mobile apps with bursty location traffic, session management by region, geo-distributed user profiles | Complex geo queries nearly impossible; single-table design learning curve; hot partitions if users cluster in one area; range queries limited; need pre-computed geohashes |
| **S2 Geometry (Google's library)** | Geometric library used with any DB | Hierarchical space-filling curves; consistent cell boundaries globally; handles poles/datelines correctly; efficient bit operations | Global tile-based systems, precise location-to-cell mapping, seamless cross-region queries, geographic hierarchies | Not a database; requires implementation effort; learning curve steep; requires pre-processing locations into cells |
| **H3 Hexagonal Index** | Hierarchical hexagonal grid (Uber's) | Hexagonal cells (no biasing); great for aggregations by region; consistent parent-child hierarchy; smaller cell sizes than S2 | Uber-style mapping (hexagonal heat maps), fleet optimization, region-based analytics, disaster response zones | Pre-processing cost; not native to all databases; larger index than geohash; client-side computation overhead |
| **Geohash-based Sharding** | Custom partitioning strategy | Simple implementation; reduces range query complexity; can be pre-computed | Distributed systems needing geo-aware sharding, pre-computing user regions, hot-spot mitigation | Approximation (cell boundaries don't match exact distances); requires custom code; ordering by distance not native; geohash collision edge cases |
| **Neo4j with Spatial Data** | Graph DB with spatial plugin | Graph-native geospatial traversals; relationship-based location logic (friends near you); strong for social/location networks | Social networks with location relationships (friends near me), recommendation systems with geo filters, network topology with locations | Overkill for pure location queries; scaling challenges for massive graphs; spatial queries not as optimized as PostGIS |

---

### Detailed Decision Flowchart: Location Queries

**Question 1: How many location queries per second (QPS)?**
- **< 100 QPS**: PostgreSQL + PostGIS (simplicity, ACID, complex queries)
- **100-10K QPS**: Redis Geo or MongoDB (fast reads, moderate scaling)
- **> 10K QPS**: Redis Geo + PostgreSQL (Redis for hot reads, Postgres for cold/complex)

**Question 2: Query complexity?**
- **Simple radius/nearby**: Redis Geo or DynamoDB Geo Partitioning (blazing fast)
- **Radius + filters (distance + category)**: MongoDB Geo Indexes or Elasticsearch
- **Complex polygons + analytics**: PostgreSQL + PostGIS
- **Full-text search + location**: Elasticsearch with geo plugin

**Question 3: Scale and data distribution?**
- **Single region, < 10GB data**: PostgreSQL + PostGIS
- **Multi-region, high write volume**: DynamoDB Geo Partition (serverless) or Redis Geo + Postgres replication
- **Globally distributed users**: S2/H3 geohash + DynamoDB or Cassandra (pre-compute regions)

**Question 4: Consistency requirements?**
- **Strong consistency critical**: PostgreSQL + PostGIS (ACID transactions)
- **Eventual consistency acceptable**: Redis Geo (cache layer), MongoDB, Elasticsearch

**Question 5: Need real-time updates?**
- **Yes (food delivery, rideshare)**: Redis Geo (TTL for expiring locations) + pub/sub for updates
- **Not critical**: PostgreSQL + PostGIS with caching, DynamoDB

---

### Common Location Query Patterns

| Pattern | Best Solution | Why | Example |
|---------|---------------|-----|---------|
| **Find nearby (radius search)** | Redis Geo with GEORADIUS | O(log N) with distance sorting; <10ms latency | "Nearby restaurants within 5km" |
| **K-nearest neighbors** | MongoDB Geo Aggregate Pipeline or PostGIS | Both efficient; MongoDB for flexible schema, PostGIS for complex geometries | "5 closest Uber drivers" |
| **Bounding box (rectangular region)** | Redis GEORADIUSBYMEMBER or PostgreSQL | Redis for speed; PostGIS for accurate geography | "All delivery zones in viewport" |
| **Point-in-polygon (user in zone)** | PostgreSQL PostGIS ST_Contains | Handles complex polygon boundaries; ACID safe | "Is delivery address within service area?" |
| **Distance matrix (many-to-many)** | PostgreSQL PostGIS or S2 geometry | PostGIS for accuracy; S2 for pre-computation | Route optimization, distance between all depot-customer pairs |
| **Geofence (notify when entering region)** | Redis Geo + streams or DynamoDB Geo + Lambda | Redis for hot geofences; DynamoDB for serverless | Geo-triggered notifications, store crossing alerts |
| **Aggregation by region (heatmap)** | Elasticsearch Geo Aggregate or H3 bucketing | Elasticsearch for combined geo + analytics; H3 for custom regions | "Orders by delivery zone", "traffic density map" |
| **Hierarchical regions (country→state→city)** | PostgreSQL PostGIS + hierarchical tables or S2/H3 | PostGIS for ACID joins; S2/H3 for cell hierarchies | "All cities in California with avg distance" |

---

### Real-World Trade-offs: Examples

**Use PostgreSQL + PostGIS when:**
- Complex multi-criteria queries (distance + polygon + filters)
- ACID consistency critical (financial transactions with locations)
- Moderate QPS (<1K), accept eventual caching layer
- Team familiar with SQL and spatial extensions
- Example: Ride-sharing pricing zone verification, property boundary queries

**Use Redis Geo when:**
- Simple radius searches dominate (nearby driver/restaurant queries)
- Real-time, sub-millisecond latency required
- Can tolerate eventual consistency (cache layer over DB)
- User locations change frequently (need TTL auto-expire)
- Example: Uber finding nearby drivers, food delivery "nearby restaurants"

**Use MongoDB Geo Indexes when:**
- Flexible schema with location data (user profiles with optional location)
- Combining location filters with other document queries
- Moderate QPS with geographic scaling via sharding
- Example: Dating app "find matches within 20 miles who like hiking"

**Use Elasticsearch Geo when:**
- Location search + full-text search together (restaurants near me + name search)
- Complex aggregations (heatmaps, zone analytics)
- Accept higher latency (100ms+) for powerful analytics
- Example: Job search "Software engineer jobs in NYC area"

**Use DynamoDB Geo Partitioning when:**
- Serverless, minimal ops requirement
- Predictable location distribution (geohash bucket design)
- Can pre-compute regions (avoid hot partitions)
- Example: Mobile app tracking user sessions by region, IoT device location tracking

**Use S2/H3 Geometry Libraries when:**
- Building custom tiling/hexagonal systems
- Globally accurate cells (poles, datelines matter)
- Pre-computing expensive: heatmaps, regional aggregations
- Example: Uber's hexagon-based fleet optimization, disaster response zone mapping

---

## Read Replicas vs Sharding

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

## Normalization vs Denormalization

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

## Data Structures & Indexing Tradeoffs

| Structure | Strengths | Tradeoffs | When to Use |
|----------|-----------|-----------|-------------|
| **Bloom Filter** | Very space-efficient membership checks; O(k) inserts/queries; avoids expensive lookups | False positives; no value retrieval; hard deletes unless counting/quotient; needs sizing to meet FP rate | Prefiltering before DB/cache lookups, cache-penetration protection, existence checks at massive scale |
| **Redis Hash (Hash Map)** | Compact storage for many small fields; O(1) field access; atomic field updates | No per-field TTL; no secondary indexes or range queries; very large hashes can rehash and become memory-heavy | Grouping related attributes under one key (user profiles, counters, feature flags) |
| **Trie (Prefix Tree)** | Fast prefix search/autocomplete; lexicographic traversal; O(k) lookups | High memory overhead; pointer-heavy/cache-unfriendly; slower for random access vs hash | Prefix matching, autocomplete, routing tables, dictionary lookups |
| **B+ Tree** | Ordered index; efficient range scans; disk/page-friendly with high fanout | More complex writes (splits/merges); slower point lookups than hash; tuning page size and fill factor | Database indexes, range queries, ordered pagination, time-series by key |

**Why Choose Bloom Filter:**
- Minimize expensive DB hits for non-existent keys
- Protect caches from "thundering misses" or abuse
- Pre-check existence in distributed systems

**Why Choose Redis Hash:**
- Reduce key overhead vs many small keys
- Update fields atomically without rewriting whole object
- Keep related data co-located for cache locality

**Why Choose Trie:**
- Prefix search or autocomplete is core query
- Need ordered, lexicographic traversal
- Longest-prefix matching (routing, IPs)

**Why Choose B+ Tree:**
- Range queries, ordered scans, and pagination
- Disk-based storage where minimizing IO matters
- Multi-column indexes that benefit from ordering

**Tradeoff Summary:**
- Bloom Filter: Space-efficient existence checks ↔ False positives, no value retrieval
- Redis Hash: Memory efficiency + field-level updates ↔ No per-field TTL, no range queries
- Trie: Fast prefix queries ↔ High memory overhead
- B+ Tree: Range scans + ordered access ↔ More complex writes

---

## Interview Questions & Answers

### Q1: Design a recommendation system like Netflix. Would you use SQL or NoSQL? Why?

**Answer:**
**Use MongoDB (NoSQL)** for the following reasons:
- **Flexible schema**: User preferences, watch history, and metadata change frequently
- **Horizontal scalability**: Netflix scales to millions of users globally
- **Document model**: Natural representation of complex nested data (shows, ratings, genres)
- **Eventual consistency acceptable**: Real-time recommendations don't need strict ACID

**However, use PostgreSQL for:**
- Payment and billing (ACID critical)
- User authentication (strong consistency needed)

**Hybrid approach**: MongoDB for user viewing history/recommendations + PostgreSQL for core transactions = best of both worlds.

---

### Q2: You're building an Uber-like system. How would you handle location queries for "find nearby drivers"?

**Answer:**
**Primary: Redis Geo** because:
- Drivers' locations update frequently (every few seconds)
- Need <100ms latency for instant matching
- Simple radius search (5-10km around user)
- O(log N) complexity with distance sorting

**Secondary: PostgreSQL + PostGIS** because:
- Store driver locations persistently (RDB backup)
- Handle edge cases (no drivers in radius, unexpected zones)
- Analytics queries (driver distribution by hour, peak zones)

**Architecture**:
1. Driver sends location → Redis Geo (real-time, fast)
2. Periodically sync to PostgreSQL (eventual consistency)
3. Use S2/H3 for surge pricing zones (pre-computed hexagons)
4. For analytics, query PostgreSQL historical data

---

### Q3: Your database reads are slow. Should you add read replicas or shard?

**Answer:**
**Decision tree**:
1. **Check read:write ratio**: If 10:1 or higher → **Read replicas**
   - Example: News site (mostly reads, few updates)
   - Simpler, no cross-shard coordination
   
2. **If write-heavy** (high traffic, write volume exceeds single DB) → **Sharding**
   - Example: Real-time metrics, IoT sensors, high-frequency trading
   - Write scaling required; replicas alone won't help

3. **Combination approach** (most real systems):
   - Shard by user_id or geographic region
   - Add replicas to each shard (primary + 2 secondaries)
   - Example: Stripe payment system (sharded by merchant_id, replicated for HA)

**Performance check before deciding**:
- Run `EXPLAIN ANALYZE` on slow queries
- Add indexes first (often solves 80% of slowness)
- Then consider replicas/sharding

---

### Q4: When designing a social network (like Facebook), should you normalize or denormalize the user profile?

**Answer:**
**Denormalize user profiles** because:
- User profiles are read-heavy (viewed hundreds of times, updated rarely)
- Denormalized: `{ user_id, name, profile_pic, bio, location, friends_count }`
- Avoids expensive joins on every page load

**But normalize core data**:
- User credentials, email, phone → normalized (change rarely, critical consistency)
- Payments and transactions → heavily normalized (ACID required)

**Practical implementation**:
<details>
<summary>Click to view code</summary>

```
Normalized tables:
- users (id, email, password_hash, created_at)
- user_profiles (user_id, name, bio, location) → denormalized cache

On profile update:
1. Update user_profiles (fast read)
2. Sync background job to update cache in Redis
3. Read heavy calls hit cache/denormalized data
```

</details>

**Tradeoff**: Trade storage for speed; profile denormalization costs 10% more storage but saves thousands of joins.

---

### Q5: How would you design geospatial queries for a map-based service like Google Maps?

**Answer:**
**Layered approach**:

1. **Index level**: PostgreSQL + PostGIS
   - Store all geographic data (roads, POIs, boundaries)
   - Handle complex queries (within polygon, distance calculations)
   
2. **Cache level**: Redis Geo
   - Cache hot queries (major cities, popular routes)
   - <10ms latency for cached results
   
3. **Pre-computation level**: S2/H3 geometry
   - Pre-compute tiles and hexagons
   - Avoid expensive real-time calculations
   - Use for heatmaps, density-based features

**Query flow for "restaurants near me"**:
<details>
<summary>Click to view code</summary>

```
User location (40.7128, -74.0060) within 5km

1. Check Redis Geo: GEORADIUS restaurants 40.7128 -74.0060 5km
2. Cache hit → return instantly
3. Cache miss → Query Elasticsearch (location + full-text search on "restaurant")
4. Elasticsearch queries PostgreSQL + PostGIS for complex boundaries
5. Store result in Redis with 1-hour TTL
```

</details>

This hybrid design balances **speed** (Redis), **power** (PostGIS), and **scale** (Elasticsearch).

