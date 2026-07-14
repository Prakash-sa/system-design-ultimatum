# Caching Strategies

## Cache Aside vs Write-Through vs Write-Behind

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

## Caching Strategies Deep Dive

### Cache Aside (Lazy Loading) Pattern

<details>
<summary>Click to view code</summary>

```
GET request → Check Cache → Hit → Return
                         ↓
                       Miss → Query DB → Store in Cache → Return
```

</details>

**Pros:**
- Simplest to implement; no special cache setup
- Cache only contains accessed data (no waste)
- Resilient: DB failures don't block (stale cache still works)
- Great for unpredictable access patterns

**Cons:**
- First request always slow (cache miss)
- Stale data possible (no cache coherency)
- "Cache Stampede": Multiple requests for same miss key → multiple DB hits

**Best for:** User profiles, product pages, search results

**Implementation (Redis + Python):**
<details>
<summary>Click to view code (python)</summary>

```python
def get_user(user_id):
    # Check cache
    cached = redis.get(f"user:{user_id}")
    if cached:
        return json.loads(cached)
    
    # Cache miss: load from DB
    user = db.query(f"SELECT * FROM users WHERE id={user_id}")
    
    # Store in cache (1-hour TTL)
    redis.setex(f"user:{user_id}", 3600, json.dumps(user))
    
    return user
```

</details>

---

### Write-Through Pattern

<details>
<summary>Click to view code</summary>

```
SET request → Write to Cache → Write to DB → Return
              (synchronous)
```

</details>

**Pros:**
- Cache always consistent with DB
- No stale data
- Read hits are ultra-fast (cache warmed)

**Cons:**
- Write latency doubled (two writes sequentially)
- Cache fills with unread data (memory waste)
- If cache fails, requests block until DB responds

**Best for:** Inventory, pricing, financial data (consistency > latency)

**Implementation (Redis + Python):**
<details>
<summary>Click to view code (python)</summary>

```python
def update_product_price(product_id, new_price):
    # Write to cache first
    redis.set(f"product:{product_id}:price", new_price)
    
    # Then write to DB
    db.execute(f"UPDATE products SET price={new_price} WHERE id={product_id}")
    
    return {"status": "success"}
```

</details>

**Tradeoff**: Users wait ~10-50ms extra per write, but reads are instant.

---

### Write-Behind (Write-Back) Pattern

<details>
<summary>Click to view code</summary>

```
SET request → Write to Cache → Return (asynchronously write to DB)
                              ↓
                     Background job syncs to DB
```

</details>

**Pros:**
- Extremely fast writes (cache write only)
- Reduced DB load (batch writes, deduplication)
- Can reorder/optimize writes

**Cons:**
- Cache failure = data loss
- Consistency lag (DB lags cache by seconds/minutes)
- Requires reliable queue/persistence (RDB, AOF)

**Best for:** Analytics events, logs, non-critical metrics

**Implementation (Redis + async job):**
<details>
<summary>Click to view code (python)</summary>

```python
# Fast write to cache
def log_event(user_id, event_type):
    redis.lpush(f"events:{user_id}", json.dumps({
        "type": event_type,
        "timestamp": time.time()
    }))
    return {"status": "queued"}

# Background worker (runs every 10 seconds)
def flush_events_to_db():
    for user_id in redis.keys("events:*"):
        events = redis.lrange(f"events:{user_id}", 0, -1)
        db.batch_insert("events", events)
        redis.delete(f"events:{user_id}")
```

</details>

**Risk**: If Redis crashes before flush, events are lost. Use RDB/AOF to mitigate.

---

### Refresh-Ahead Pattern

<details>
<summary>Click to view code</summary>

```
User requests data → Cache always has fresh copy (proactively refreshed)
                   ↓
            Background job refreshes before expiry
```

</details>

**Pros:**
- Zero cache miss latency (always fresh data)
- Predictable performance
- Ideal for high-traffic pages

**Cons:**
- Wasted computation if data not accessed
- Complex implementation (need scheduler)
- Hard to predict optimal refresh interval

**Best for:** Homepage, trending content, dashboards

**Implementation:**
<details>
<summary>Click to view code (python)</summary>

```python
# Refresh-Ahead for trending articles
def refresh_trending_articles():
    articles = db.query("SELECT * FROM articles ORDER BY views DESC LIMIT 10")
    redis.set("trending:articles", json.dumps(articles))
    redis.expire("trending:articles", 300)  # 5-minute TTL

# Schedule every 4.5 minutes (refresh before 5-minute expiry)
schedule.every(4.5).minutes.do(refresh_trending_articles)

# On read: always fast
def get_trending():
    return redis.get("trending:articles")  # Guaranteed hit
```

</details>

---

## Cache Invalidation Strategies

### TTL-Based (Simple)
<details>
<summary>Click to view code</summary>

```
SET key value EX 3600  # Expires in 1 hour
```

</details>

**Pro**: Simple, no coordination
**Con**: Stale data for up to TTL duration

### Event-Based (Accurate)
<details>
<summary>Click to view code</summary>

```
On data update:
  1. Update database
  2. Publish "user:123:updated" event
  3. Cache subscribers delete key
```

</details>

**Pro**: Instant invalidation, no stale data
**Con**: Complex, requires pub/sub

### Hybrid (Best Practice)
<details>
<summary>Click to view code</summary>

```
TTL + Event-based:
  1. Set 1-hour TTL (safety net)
  2. On write, publish invalidation event (immediate)
  3. If event missed, TTL catches it eventually
```

</details>

---

## Interview Questions & Answers

### Q1: Design a caching strategy for Uber's surge pricing. What pattern would you use?

**Answer:**
**Use Write-Through** because:
- Consistency critical: incorrect pricing loses money
- Write frequency: moderate (updated every 5-10 minutes by algorithm)
- Read frequency: extremely high (every ride request)

**Implementation**:
<details>
<summary>Click to view code</summary>

```
Surge pricing update:
  1. Algorithm calculates new price_multiplier for zone
  2. Write to cache: SET surge:zone:123 1.5x
  3. Write to database: UPDATE surge_pricing SET multiplier=1.5
  4. Return confirmation

Rider requests ride:
  1. GET surge:zone:123 → Returns 1.5x instantly (cache hit)
  2. Zero latency, always consistent with DB
```

</details>

**Why not Write-Behind?** If cache loses surge pricing, system would quote wrong prices, losing revenue.

---

### Q2: You're designing a Twitter-like feed cache. The feed is read-heavy but updates aren't critical. Which pattern?

**Answer:**
**Use Cache Aside** because:
- Unpredictable access: users request different feeds (friends vary)
- Stale data acceptable: tweets 5 minutes old are fine
- Simple implementation: no write coordination needed

**Implementation**:
<details>
<summary>Click to view code (python)</summary>

```python
def get_home_feed(user_id):
    cache_key = f"feed:{user_id}"
    
    # Check cache first
    feed = redis.get(cache_key)
    if feed:
        return json.loads(feed)
    
    # Cache miss: query DB
    feed = db.query("""
        SELECT tweets FROM tweets 
        WHERE author_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
        ORDER BY created_at DESC LIMIT 50
    """, user_id)
    
    # Store for 10 minutes
    redis.setex(cache_key, 600, json.dumps(feed))
    return feed
```

</details>

**Cache Stampede Protection**:
<details>
<summary>Click to view code (python)</summary>

```python
def get_feed_with_lock(user_id):
    cache_key = f"feed:{user_id}"
    feed = redis.get(cache_key)
    if feed:
        return json.loads(feed)
    
    # Use lock to prevent multiple DB queries
    lock_key = f"feed:{user_id}:lock"
    if redis.set(lock_key, "1", NX=True, EX=5):
        # Got lock, fetch from DB
        feed = fetch_from_db(user_id)
        redis.setex(cache_key, 600, json.dumps(feed))
    else:
        # Wait for lock holder to populate cache
        time.sleep(0.1)
        feed = redis.get(cache_key)
    
    return json.loads(feed)
```

</details>

---

### Q3: Your system writes 1 million events/second. Which caching strategy handles this?

**Answer:**
**Use Write-Behind** because:
- Write latency matters: 1M events/sec = can't afford 2 writes (Write-Through)
- Eventual consistency acceptable: logs/events can lag
- Batch efficiency: Collect 100K events, write once = 10x throughput

**Architecture**:
<details>
<summary>Click to view code</summary>

```
Events → Redis queue → Batch processor → PostgreSQL
  ↓
  1M writes/sec (Cache side only, instant)
  ↓
  Background job every 100ms
  ↓
  10K-100K events/batch → PostgreSQL (optimized bulk insert)
```

</details>

**Implementation**:
<details>
<summary>Click to view code (python)</summary>

```python
# Fast write (cache only)
def log_event(event):
    redis.lpush("events:pending", json.dumps(event))
    # Optional: if queue > threshold, trigger flush
    if redis.llen("events:pending") > 50000:
        flush_to_db()

# Batch flush (runs every 100ms)
def flush_to_db():
    events = redis.lrange("events:pending", 0, -1)
    if not events:
        return
    
    # Batch insert
    db.execute("""
        INSERT INTO events (user_id, type, timestamp) 
        VALUES (?, ?, ?)
    """, [(e['user_id'], e['type'], e['ts']) for e in events])
    
    redis.delete("events:pending")
```

</details>

**Tradeoff**: If Redis crashes, lose ~100ms of events. Mitigate with RDB persistence (fsync every 100ms).

---

### Q4: When would you NOT use caching? When is it counterproductive?

**Answer:**
**Don't cache when:**

1. **Data changes constantly** (> 50% update:read ratio)
   - Example: Real-time stock prices, live auction bids
   - Cache becomes stale immediately
   - Better: Stream data directly

2. **Data is tiny** (< 1KB)
   - Example: Single boolean flags
   - Cache overhead > benefit
   - Better: Store in application state or database

3. **First-access is critical**
   - Example: Medical records (must be current)
   - Cache lag is dangerous
   - Better: No cache, strong consistency

4. **Memory is constrained**
   - Example: IoT devices with 512MB RAM
   - Cache eviction thrashing
   - Better: Optimize database queries instead

5. **Data has complex dependencies**
   - Example: Calculated fields depending on 5+ tables
   - Invalidation is complex and error-prone
   - Better: Compute on-demand or use materialized views

**Example scenario**: 
<details>
<summary>Click to view code</summary>

```
User updates profile name → cascades to:
- Comment author names
- Post author names  
- Mention notifications
- Search indexes

Caching this = invalidation nightmare.
Better: Store only in DB, compute names on-demand
```

</details>

---

### Q5: How would you choose a TTL (time-to-live) for cached data?

**Answer:**
**Formula**: `TTL = max(acceptable_staleness, computation_cost)`

**Guidelines by use case:**

| Use Case | TTL | Reason |
|----------|-----|--------|
| Homepage | 1-5 minutes | Content changes frequently, load is predictable |
| User profile | 10-30 minutes | Rarely changes, acceptable to be 10min stale |
| Product catalog | 1 hour | Changes during business hours, not real-time |
| Leaderboard | 5 seconds | Competitions require near-real-time accuracy |
| Static assets | 24 hours | Never changes after upload |
| Auth tokens | Token lifetime | Security critical, don't extend arbitrarily |
| DB query result | Variable | Depends on data freshness requirement |

**Dynamic TTL example**:
<details>
<summary>Click to view code (python)</summary>

```python
def get_product(product_id):
    if is_flash_sale_active():
        ttl = 10  # 10 seconds (prices changing fast)
    else:
        ttl = 3600  # 1 hour (normal case)
    
    cache_key = f"product:{product_id}"
    product = redis.get(cache_key)
    if not product:
        product = db.query(f"SELECT * FROM products WHERE id={product_id}")
        redis.setex(cache_key, ttl, json.dumps(product))
    return product
```

</details>

**Rule of thumb**:
- If data updates hourly → TTL = 15 minutes (cache 4 stale versions)
- If data updates daily → TTL = 4 hours
- If data updates on-demand → TTL = 0 (cache-aside with event invalidation)

