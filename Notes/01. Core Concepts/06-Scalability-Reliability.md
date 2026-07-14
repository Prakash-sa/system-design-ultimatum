# Scalability and Reliability Patterns

## Back-of-Envelope Calculations

Quick estimation techniques for system design interviews. These are rough estimates used to validate architectural decisions.

### Time and Storage Units

| Unit | Bytes | Time |
|------|-------|------|
| **KB** | 10³ | 1 millisecond |
| **MB** | 10⁶ | 1 second |
| **GB** | 10⁹ | 1 minute |
| **TB** | 10¹² | 1 hour |
| **PB** | 10¹⁵ | 1 day |

### Latency Numbers Every Programmer Should Know

<details>
<summary>Click to view code</summary>

```
L1 cache reference:                     0.5 ns
Branch mispredict:                      5 ns
L2 cache reference:                     7 ns
Mutex lock/unlock:                    100 ns
Main memory reference:                100 ns
Compress 1KB with Snappy:           3,000 ns (3 µs)
Send 1KB over 1 Gbps network:      10,000 ns (10 µs)
Read 1MB sequentially from memory: 250,000 ns (250 µs)
Round trip within same datacenter:  500,000 ns (500 µs)
Read 1MB sequentially from SSD:   1,000,000 ns (1 ms)
Disk seek:                        10,000,000 ns (10 ms)
Read 1MB sequentially from disk:  20,000,000 ns (20 ms)
Send packet CA → Netherlands:    150,000,000 ns (150 ms)
```

</details>

**Rule of thumb**: Disk is ~40x slower than memory, network is ~150-200x slower than memory

### Common QPS (Queries Per Second) Calculations

**Given**: X million users, Y% daily active, Z requests per user per day

<details>
<summary>Click to view code</summary>

```
Formula: (X million × Y% × Z requests) / (86,400 seconds/day)

Example: 1B users, 50% DAU, 10 requests/day
= (1,000,000,000 × 0.5 × 10) / 86,400
= 5,000,000,000 / 86,400
= ~57,870 QPS

Peak traffic rule: Multiply by 3-5x (peak is 3-5x average)
= 57,870 × 5 = ~290,000 QPS peak
```

</details>

### Data Volume Calculations

**Given**: X million users, Y data per user, Z days retention

<details>
<summary>Click to view code</summary>

```
Formula: X million × Y × Z = total storage

Example: 1B users, 1KB per user, 30 days retention
= 1,000,000,000 × 1KB × 30
= 30TB total

But need redundancy:
- 3x replication: 30TB × 3 = 90TB
- 2x for backup: 30TB × 2 = 60TB
- Total: ~150TB
```

</details>

### Database Sizing

**Single MySQL server capacity**:
<details>
<summary>Click to view code</summary>

```
Memory: 64GB
Max connections: 10,000
Throughput: 
  - 10,000 QPS read (cached)
  - 1,000 QPS write
  - Mixed: 5,000 QPS

Before hitting CPU/memory limits, disk I/O becomes bottleneck
```

</details>

**When to shard**:
<details>
<summary>Click to view code</summary>

```
Data size: > 1TB → Consider sharding
QPS: > 10,000 → Consider sharding
Connections: > 5,000 → Consider sharding

Sharding key: User ID, geographic region, or hash
```

</details>

### Server Capacity Planning

**Single web server (8 core, 32GB RAM)**:
<details>
<summary>Click to view code</summary>

```
Memory per connection: ~1MB
Max connections: 32,000

QPS capacity:
- Simple operations: ~10,000 QPS
- Complex operations: ~1,000 QPS
- CPU-bound: ~5,000 QPS
```

</details>

**Number of servers needed**:
<details>
<summary>Click to view code</summary>

```
Formula: Peak QPS / QPS per server

Example: 300,000 peak QPS, 10,000 QPS per server
= 300,000 / 10,000 = 30 servers

With redundancy (rolling updates, failures):
= 30 × 1.3 = 39 servers (30% buffer)
```

</details>

### Load Balancer Sizing

<details>
<summary>Click to view code</summary>

```
Modern LB (AWS ALB):
- Max 25,000 new connections/second
- Max 1,000,000 concurrent connections per LB

For 10M concurrent connections:
= 10,000,000 / 1,000,000 = 10 LBs needed

For multi-region HA:
= 10 LBs × 2 regions = 20 LBs total
```

</details>

### Cache Sizing

**Rule**: Cache hit rate ~90% means 10x reduction in database load

<details>
<summary>Click to view code</summary>

```
Example without cache:
- 100,000 QPS to database
- Database capacity: 10,000 QPS
- Problem: Overloaded

With cache (90% hit rate):
- Cache serves: 90,000 QPS (in-memory, fast)
- DB serves: 10,000 QPS (miss traffic)
- Balanced!
```

</details>

**Cache memory needed**:
<details>
<summary>Click to view code</summary>

```
Formula: (QPS × avg_object_size × TTL) / hit_rate

Example: 100,000 QPS, 1KB avg object, 1 hour TTL, 90% hit rate
= (100,000 × 1KB × 3,600) / 0.9
= 360,000,000 KB / 0.9
= ~400GB cache

Practical: Use distributed cache (Redis) across 10 servers
= 40GB per Redis instance (reasonable)
```

</details>

### Bandwidth Calculation

**Given**: Peak QPS, average response size

<details>
<summary>Click to view code</summary>

```
Formula: Peak QPS × Avg response size

Example: 300,000 peak QPS, 10KB response
= 300,000 × 10KB = 3,000,000 KB/s = 3GB/s

Bandwidth needed:
- 10 Gbps link: 10GB/s (can handle it)
- But need redundancy: 2 × 10Gbps = 20Gbps total

Rule of thumb: Provision 2-3x peak bandwidth for headroom
```

</details>

### Video Streaming Bandwidth

<details>
<summary>Click to view code</summary>

```
Netflix scenario: 100M users, 50% watching simultaneously

Bitrate per stream: 5 Mbps (HD)
Total bandwidth needed: 50M × 5 Mbps = 250 Tbps

Wow, that's massive! How does Netflix handle it?

Solution: CDN + regional caching
- Cache video in edge locations (ISP networks)
- Only ~10-20% requires backbone traffic
- Backbone: 250 Tbps × 15% = 37.5 Tbps (still huge, but manageable)
```

</details>

### Example: Design Instagram Feed for 100M DAU

<details>
<summary>Click to view code</summary>

```
1. Calculate QPS:
   - 100M DAU × 20 requests/day / 86,400 = ~23,000 QPS avg
   - Peak: 23,000 × 5 = ~115,000 QPS

2. Database sizing:
   - Each feed = 100 posts × 1KB = 100KB
   - 100M users × 100KB = 10TB storage
   - With 3x replication: 30TB
   - Needs sharding (> 1TB)

3. Server capacity:
   - 115,000 peak QPS / 10,000 per server = 11.5 → 15 servers
   - With 30% redundancy: ~20 servers

4. Cache sizing:
   - 90% hit rate assumption
   - Feed objects: 100M users × 100KB × 0.1 (10% miss) = 1TB
   - Split across 25 Redis instances = 40GB each

5. Bandwidth:
   - 115,000 QPS × 100KB = 11.5GB/s
   - Need 100 Gbps backbone
```

</details>

### Back-of-Envelope Checklist

When estimating, ask:
<details>
<summary>Click to view code</summary>

```
✓ How many users? (total, DAU, peak concurrent)
✓ Request rate? (QPS average, QPS peak)
✓ Data volume? (per user, total, growth rate)
✓ Latency requirements? (response time SLA)
✓ Availability requirements? (uptime SLA)
✓ Bandwidth constraints? (network capacity)
✓ Storage retention? (how long to keep data)
✓ Consistency requirements? (strong vs eventual)

Then size:
1. Servers needed
2. Database needed
3. Cache needed
4. Bandwidth needed
5. Storage needed
```

</details>

---

## Vertical vs Horizontal Scaling

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

## CAP Theorem Tradeoffs

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

## Load Balancing Strategies

| Strategy | How It Works | Pros | Cons | When to Use |
|----------|-------------|------|------|-------------|
| **Round Robin** | Distribute requests sequentially to each server | Simple, easy to implement | No awareness of server load | Uniform workloads, simple systems |
| **Least Connections** | Route to server with fewest active connections | Handles variable request durations | Overhead of tracking connections | Long-lived connections (WebSockets) |
| **IP Hash** | Route based on client IP (consistent) | Sticky sessions without affinity | Uneven distribution if IPs cluster | Session affinity (WebSockets, stateful apps) |
| **Weighted Round Robin** | Some servers get more traffic | Handles heterogeneous servers | Need to configure weights | Mix of powerful and weak servers |
| **Random** | Pick random server | Simple, low overhead | No optimization | Very simple loads |

---

## Compare-and-Swap (CAS) for Atomic Operations

**What it is:** CPU/VM primitive that atomically updates a memory location only if its current value matches an expected value. Avoids locks for simple, contended operations.

**Why use it:** Fast and non-blocking for small critical sections like counters, versioned writes, or state flips. Reduces contention compared to coarse locks.

### How CAS Works

**Hardware level** (all at once, no interruption):
1. Read current value from memory address
2. Compare it against the expected value
3. If match: write new value and return `true`
4. If no match: discard new value and return `false`

**The atomic guarantee**: No other thread can modify the memory between the compare and swap steps.

**Conceptual flow:**
1. Read current value `cur`.
2. Compute `next` from `cur`.
3. CAS(address, expected=cur, new=next) → succeeds or fails.
4. On failure, read again and retry or back off.

**Pseudo-code (increment counter):**
<details>
<summary>Click to view code</summary>

```
do {
  cur = load(addr)                    // Read current
  next = cur + 1                      // Calculate new
} while (!CAS(addr, cur, next))       // Retry if someone changed it
```

</details>

### Real-World Examples

**1. Atomic Counter (Page View Tracking)**
<details>
<summary>Click to view code</summary>

```
// Without CAS (using lock):
lock(counter_lock)
counter++
unlock(counter_lock)
// Problem: Lock contention on hot counters

// With CAS (lock-free):
do {
  current = load(counter)
  new = current + 1
} while (!CAS(counter, current, new))
// Faster: No lock, just retry loop
// Contention is handled by retries, not waiting
```

</details>

**2. Versioned Update (Optimistic Locking)**
<details>
<summary>Click to view code</summary>

```
// Scenario: Multiple threads updating a user record version
// Thread A: Read user version=3, wants to update
// Thread B: Updates version to 4 (increments it)
// Thread A's update should fail since version changed

do {
  user = read(user_id)
  version = user.version
  user.name = "new name"
  user.version = version + 1
} while (!CAS(user_obj, version, version+1))

// This ensures: "Only commit if nobody else changed this"
```

</details>

**3. Lock-Free Stack Pop**
<details>
<summary>Click to view code</summary>

```
// Stack: head → [A] → [B] → [C]
// Thread wants to pop A

do {
  top = load(head)                    // top = [A]
  next = top.next                     // next = [B]
} while (!CAS(head, top, next))       // Replace head with [B]

// If another thread pushed new node between read and CAS:
// CAS fails, loop retries with new head
```

</details>

**4. Thread-Safe State Machine**
<details>
<summary>Click to view code</summary>

```
// States: IDLE (0), RUNNING (1), STOPPED (2)
enum State { IDLE = 0, RUNNING = 1, STOPPED = 2 }

// Only transition IDLE → RUNNING
do {
  state = load(state_var)
  if (state != IDLE) return false     // Can't start, not idle
} while (!CAS(state_var, IDLE, RUNNING))

// Guarantees: Only one thread successfully transitions to RUNNING
```

</details>

### CAS vs Locks: Performance Comparison

**Under Low Contention (few threads):**
<details>
<summary>Click to view code</summary>

```
Operation       | Lock Time  | CAS Time   | Winner
----------------|------------|------------|--------
Increment       | 50 ns      | 5 ns       | CAS (10x faster)
Read + Update   | 80 ns      | 10 ns      | CAS (8x faster)
```

</details>

**Under High Contention (many threads):**
<details>
<summary>Click to view code</summary>

```
Threads | Lock QPS    | CAS QPS     | Winner
--------|-------------|-------------|--------
1       | 1,000,000   | 5,000,000   | CAS
4       | 200,000     | 3,000,000   | CAS
16      | 50,000      | 1,500,000   | CAS (still!)
64      | 10,000      | 500,000     | CAS (now degrading)
256     | 2,000       | 50,000      | CAS (with backoff)
```

</details>

**Why CAS wins even under contention:**
- Locks: Threads block, OS scheduler overhead increases
- CAS: Threads retry, but no context switching cost
- Add exponential backoff to CAS under extreme contention

### When to Use CAS

✅ **Good for:**
- Counters (hit counters, stats)
- Sequence numbers (request IDs, event ordering)
- Simple state flags (started, completed)
- Optimistic concurrency control
- Lock-free data structures
- Reference counting

❌ **Bad for:**
- Complex multi-field updates
- Conditional logic involving multiple values
- Long critical sections
- When ABA problem is hard to solve

**Rule of thumb:** If the operation fits in 1-2 CPU instructions, CAS is better. If it requires 10+ instructions, use locks.

### The ABA Problem and Solutions

**What is it:**
<details>
<summary>Click to view code</summary>

```
Thread 1: reads value = A
         (context switch)
Thread 2: changes A → B → A
         (thread 1 resumes)
Thread 1: CAS(addr, A, new_value)  ✓ Succeeds!
         But the A now is different from the original A!
```

</details>

**Example - Stack pop with ABA:**
<details>
<summary>Click to view code</summary>

```
// Stack: [A] → [B]
// Thread 1 tries to pop A
head = load(&stack)          // head = [A]
next = head.next             // next = [B]
                             // (Thread 2 pops [A], then pushes it back)
// Now A is a freed/reused node!
CAS(&stack, head, next)      // ✓ Succeeds, but now pointing to invalid [A]!
```

</details>

**Solutions:**

1. **Add version counter (most common):**
<details>
<summary>Click to view code</summary>

```
// Store: (value, version)
// CAS(addr, (expected_val, expected_ver), (new_val, new_ver+1))

do {
  (value, version) = load(addr)
  new_version = version + 1
} while (!CAS(addr, (value, version), (new_val, new_version)))
// Version changes guarantee uniqueness
```

</details>

2. **Use generation numbers:**
<details>
<summary>Click to view code</summary>

```
struct VersionedRef {
  void* ptr;           // The actual pointer
  uint64_t generation; // Incremented on each reuse
}
// CAS on entire struct ensures ABA safety
```

</details>

3. **Hazard pointers (advanced):**
<details>
<summary>Click to view code</summary>

```
// Thread marks pointer as "in-use"
// Other threads cannot recycle it
// Slower but fully ABA-safe
```

</details>

### Practical Considerations

**CPU Support:**
<details>
<summary>Click to view code</summary>

```
x86/x64:        CAS, CMPXCHG (single & double-wide)
ARM:            LDREX, STREX (LL/SC - Load-Link/Store-Conditional)
Modern CPUs:    Compare-And-Swap, Load-Acquire, Store-Release (memory barriers)
```

</details>

**Language Support:**
<details>
<summary>Click to view code</summary>

```
Java:           java.util.concurrent.atomic.AtomicInteger.compareAndSet()
C++:            std::atomic::compare_exchange_strong()
Go:             sync/atomic.CompareAndSwapUint64()
Rust:           std::sync::atomic::AtomicUsize::compare_exchange()
Python:         multiprocessing.Value (limited); usually use locks
```

</details>

**When Contention Gets Too High - Add Backoff:**
<details>
<summary>Click to view code</summary>

```
// Exponential backoff
uint32_t attempts = 0;
do {
  cur = load(addr)
  next = cur + 1
  if (!CAS(addr, cur, next)) {
    // Failed, back off exponentially
    sleep(min(1ms << attempts++, 100ms))
  }
} while (CAS failed)
```

</details>

**Alternatives to CAS:**
<details>
<summary>Click to view code</summary>

```
Pattern                          | Trade-off
---------------------------------|------------------------------------------
Coarse lock                       | Simple, but high contention cost
Sharded locks (per-core)          | Good balance, less contention
CAS with backoff                  | Fast but needs tuning
Partitioned atomic variables      | Best for counters, split work across threads
Lock-free queues                  | Complex, but scale well
Eventual consistency              | Highest throughput, but weaker guarantees
```

</details>

---

## Replication Patterns

| Pattern | How It Works | Pros | Cons | When to Use |
|---------|-------------|------|------|-------------|
| **Master-Slave** | Single master writes, slaves read-only | Simple to understand | Single point of failure for writes | Read-heavy workloads |
| **Master-Master** | Multiple masters, bidirectional sync | No write SPOF | Conflict resolution complex | Multi-region setup |
| **Quorum-based** | Majority of replicas needed for consistency | Strong consistency + HA | Slower writes (wait for majority) | Critical data (banking) |

---

## SLI, SLO, and SLA

**Definitions**:

| Term | Definition | Example | Owner |
|------|-----------|---------|-------|
| **SLI** (Service Level Indicator) | A specific metric that measures system behavior | API response time: 95th percentile = 200ms; Error rate: 0.01% | Engineering |
| **SLO** (Service Level Objective) | Internal target for SLI performance | API response time should be ≤200ms for 99.5% of requests | Engineering & PM |
| **SLA** (Service Level Agreement) | Legal commitment with consequences for missing SLO | If uptime <99.9%, customer gets 10% refund | Business/Legal |

**Key Differences**:
- **SLI**: Measurement (what we track)
- **SLO**: Target (what we aim for)
- **SLA**: Contract (what we promise)

---

### Common SLIs

| Category | Metric | How to Measure | Good Target |
|----------|--------|----------------|-------------|
| **Availability** | Uptime | `(total_time - downtime) / total_time` | 99.9% (8.76 hrs/year downtime) |
| **Latency** | Response time (P50, P95, P99) | Request → Response time | P95 < 200ms, P99 < 1s |
| **Error rate** | Failed requests / total requests | HTTP 5xx + timeouts | < 0.1% |
| **Throughput** | Requests per second | Track QPS | Track trend, alert on drops |
| **Completeness** | Data accuracy | Queries returning correct results | > 99.9% accuracy |
| **Freshness** | Data staleness | Time since last update | < 5 minutes (depends on use case) |

---

### SLO Target Hierarchy

<details>
<summary>Click to view code</summary>

```
Enterprise customers: 99.99% uptime (52 minutes/year downtime)
  ↓
Standard customers: 99.9% uptime (8.76 hours/year downtime)
  ↓
Free tier: 99% uptime (3.65 days/year downtime)

Why tiered?
- Premium customers need higher reliability
- Premium tier → higher cost → justifies more ops investment
```

</details>

**Cost vs reliability**:
<details>
<summary>Click to view code</summary>

```
99% uptime: 1 failure/100 requests (cheap infra)
99.9% uptime: 1 failure/1000 requests (replicas + monitoring)
99.99% uptime: 1 failure/10,000 requests (multi-region, chaos testing)
99.999% uptime: 1 failure/100,000 requests (enterprise-grade)

Each 9 costs ~3-5x more than the previous level
```

</details>

---

### Error Budget Concept

**Error budget** = Allowed downtime in a period to still meet SLO

<details>
<summary>Click to view code</summary>

```
SLO: 99.9% uptime per month
Total month hours: 730 hours
Error budget: (1 - 0.999) × 730 = 0.73 hours = 43.8 minutes/month

If already used 30 minutes, only 13.8 minutes remaining
→ Can't do risky deployments
→ Must be extra cautious (no canary → full rollout)
```

</details>

**Managing error budget**:
<details>
<summary>Click to view code (python)</summary>

```python
# Example implementation
error_budget_remaining = calculate_budget_remaining()

if error_budget_remaining > 50%:
    # Aggressive: canary deployment, feature flags
    deploy_with_canary()
    
elif error_budget_remaining > 10%:
    # Conservative: manual rollout, heavy monitoring
    deploy_manually_with_heavy_monitoring()
    
else:
    # Critical: freeze all deployments
    only_fix_critical_bugs()
    no_new_features()
```

</details>

**Incident impact on budget**:
<details>
<summary>Click to view code</summary>

```
Incident: User auth service down for 10 minutes
Impact: 10,000 failed requests / 1,000,000 total = 1% error rate

Error budget burn:
  If SLO is 99.9% (0.1% errors allowed)
  This incident used: 1% / 0.1% = 10x the budget
  
Result: Error budget depleted for rest of month
```

</details>

---

### SLO Design Best Practices

**1. Make SLOs realistic**
<details>
<summary>Click to view code</summary>

```
Bad SLO: 99.99% on single-region system (impossible)
Good SLO: 99% on standard tier, 99.9% on premium

Reality: Systems with single points of failure max out at ~99%
Multi-region systems can reach 99.99%
```

</details>

**2. Balance multiple metrics**
<details>
<summary>Click to view code</summary>

```
# Don't just optimize uptime
SLO for Netflix:
  - Uptime: 99.99%
  - Latency (P99): < 1 second
  - Error rate: < 0.1%
  
Optimizing only uptime can hurt latency
(always return cached/stale data = 100% uptime but bad UX)
```

</details>

**3. Set SLOs lower than infrastructure capability**
<details>
<summary>Click to view code</summary>

```
Infrastructure: 99.99% availability
SLO: 99.9% availability (leave 0.09% buffer)

Why buffer?
- Deployments, maintenance
- Network blips
- Monitoring false positives
```

</details>

**4. Monitor SLI trends, not just thresholds**
<details>
<summary>Click to view code</summary>

```
Alert when:
  - P95 latency exceeds 500ms (threshold breach)
  - P95 latency increases 50% week-over-week (trend)
  
Second alert catches degradation before total failure
```

</details>

---

### SLA Examples

**Google Cloud SLA**:
<details>
<summary>Click to view code</summary>

```
Compute Engine:
  - 99.95% availability
  - Credits if breached:
    - 99%-99.95%: 10% credit
    - 95%-99%: 30% credit
    - <95%: 100% credit
    
Design: SLO (99.9%) < SLA (99.95%)
If SLO breached, still might make SLA
Extra buffer for one-time incidents
```

</details>

**AWS SLA**:
<details>
<summary>Click to view code</summary>

```
EC2:
  - 99.99% availability SLA
  - Applied per instance
  - Multiple instances in different AZs recommended
  
If one instance fails:
  - That instance gets credits
  - Other instances unaffected
```

</details>

**Stripe SLA (payment processing)**:
<details>
<summary>Click to view code</summary>

```
- 99.99% uptime required (financial services)
- <50ms latency for payment processing
- Incident response: <15 minutes
- Requires multi-region active-active setup
```

</details>

---

### Typical Service Tier SLOs

| Service Type | Uptime Target | Latency (P95) | Error Rate |
|--------------|---------------|---------------|-----------|
| **API Gateway** | 99.99% | < 50ms | < 0.01% |
| **Web server** | 99.9% | < 200ms | < 0.1% |
| **Background job** | 99% | 1 minute | < 1% |
| **Batch analytics** | 95% | 1 hour | < 5% |
| **Cache layer** | 99.5% | < 5ms | < 0.5% |

---

### Monitoring & Alerting for SLOs

<details>
<summary>Click to view code (python)</summary>

```python
# Example: Monitor SLO burn rate
def check_slo_burn():
    # SLO: 99.9% uptime = 0.1% error rate allowed
    
    current_error_rate = get_error_rate_last_hour()
    
    if current_error_rate > 1%:
        # 10x error budget burn rate
        # Will deplete monthly budget in ~3 hours
        alert("CRITICAL: SLO burn rate 10x. Incident response needed")
    
    elif current_error_rate > 0.5%:
        # 5x error budget burn rate
        alert("WARNING: High SLO burn rate. Investigate")
    
    elif current_error_rate > 0.15%:
        # 1.5x error budget burn rate (acceptable)
        log("Normal SLO burn rate")
```

</details>

---

## Circuit Breaker Pattern

<details>
<summary>Click to view code</summary>

```
Normal state:
Request → Service A → Success ✓

Failure state (too many failures):
Request → Circuit Breaker (OPEN) → Fail fast ✗ (don't call failing service)

Recovery state (after timeout):
Request → Circuit Breaker (HALF-OPEN) → Try service A
         ↓
         Success → Close circuit (back to normal)
         Failure → Open circuit again
```

</details>

**Benefits:**
- Fail fast: Don't waste time on failing services
- Cascading failure prevention: Stop propagating failures
- Recovery: Automatically retry after timeout

---

## Interview Questions & Answers

### Q1: Your single MySQL server is maxed out. Scale vertically or horizontally?

**Answer:**
**First check**:
1. Is it CPU-bound or I/O bound?
   - `top` / `iostat` shows where bottleneck is
2. Can you optimize queries first?
   - Add indexes, denormalize, cache
   - Solves 80% of issues without scaling

**If optimization doesn't help:**

**Short-term (vertical scaling)**:
- Upgrade instance: m5.large → m5.4xlarge
- Gains 3-6 months
- Quick, no downtime (if prepared replica)

**Long-term (horizontal scaling)**:
- Shard by user_id or geographic region
- Each shard gets replicas
- Unlimited scalability
- Application-level complexity

**Recommended path**:
<details>
<summary>Click to view code</summary>

```
Month 1-3: Optimize queries + vertical scale (buy time)
Month 3-6: Implement sharding (parallel effort)
Month 6+: Run sharded system (replaces single DB)
```

</details>

---

### Q2: Design Netflix architecture for 100M users. What makes it resilient?

**Answer:**
**Key principles** (Netflix Chaos Engineering):

1. **Multi-AZ deployment**
   - Users in multiple regions/AZs
   - Any single AZ failure doesn't affect users

2. **Stateless services**
   - Any server can be killed
   - No local state = easy horizontal scaling

3. **Bulkheads (isolation)**
   - Video recommendations service fails
   - Homepage still works
   - Isolated failure domains

4. **Timeouts + Circuit breakers**
   - If recommendation service slow (>1s)
   - Don't wait, use cached/default recommendations
   - Fail fast

5. **Retry with backoff**
   - Transient failures auto-recover
   - Exponential backoff prevents thundering herd

**Architecture**:
<details>
<summary>Click to view code</summary>

```
User request → Load balancer (multi-AZ)
             ↓
      API Gateway (stateless)
             ↓
   Microservices (Video, Recommendation, Billing, etc.)
             ↓
   Each service has:
   - Multiple instances (horizontal scale)
   - Read replicas (HA)
   - Circuit breakers (cascading failure prevention)
   - Cache layer (Redis)
   - Timeout/retry logic
```

</details>

**Failure scenario**:
<details>
<summary>Click to view code</summary>

```
Video service crashes
  ↓
Circuit breaker opens (fails fast)
  ↓
User gets cached video list
  ↓
Meanwhile: Auto-scaler spins up new instances
  ↓
Service recovers in 30 seconds
  ↓
Circuit breaker closes (normal)
```

</details>

---

### Q3: Design a cache invalidation strategy.

**Answer:**
**Strategies** (in order of preference):

1. **TTL (Time-To-Live)**
   - Simple: `SET key value EX 3600` (1 hour TTL)
   - Pro: No coordination needed
   - Con: Stale data until expiry

2. **Event-based invalidation**
   - On data update: `PUBLISH user:123:updated`
   - Subscribers delete cache key
   - Pro: Instant invalidation, no stale data
   - Con: Complex, requires pub/sub

3. **Hybrid** (recommended)
   - TTL + event-based
   - Event invalidates immediately
   - TTL catches missed events (safety net)

**Implementation**:
<details>
<summary>Click to view code (python)</summary>

```python
# Set with TTL
redis.setex("user:123", 3600, user_data)

# On update
db.update_user(123, new_data)
redis.publish("user:123:updated", json.dumps(new_data))

# Subscriber
def on_user_update(message):
    user_id = message['user_id']
    redis.delete(f"user:{user_id}")  # Immediate invalidation
    # Next request re-populates from DB
```

</details>

**Cache stampede mitigation**:
<details>
<summary>Click to view code</summary>

```
Multiple requests for same key after expiry
→ All hit DB simultaneously
→ Database overloaded

Solution: Probabilistic early expiry
```

</details>

python
def get_user(user_id):
    cached = redis.get(f"user:{user_id}")
    if cached:
        ttl = redis.ttl(f"user:{user_id}")
        
        # If TTL < 10% remaining, refresh with probability
        if ttl < 360 and random.random() < 0.1:
            # One thread refreshes while others use stale
            refresh_in_background(user_id)
        
        return cached
    
    # Load from DB, set cache
    user = db.get(user_id)
    redis.setex(f"user:{user_id}", 3600, user)
    return user
<details>
<summary>Click to view code</summary>

```

---

### Q4: Design a system to survive an entire AWS region failure.

**Answer:**
**Active-Active multi-region** (required):

```

</details>

User requests → DNS routing (Route 53)
             ↓
      Geolocation/latency routing
             ↓
    Region 1 (US East)    Region 2 (US West)
    - App instances      - App instances
    - Database           - Database
    - Cache              - Cache
    
User in California → Route 53 sends to US West (lower latency)
User in Virginia → Route 53 sends to US East

If US East crashes:
  - Route 53 detects health check failure
  - All users → US West (higher latency but working)
<details>
<summary>Click to view code</summary>

```

**Database replication**:
```

</details>

Multi-master replication (MySQL, DynamoDB)
Region 1 DB ←→ Region 2 DB

Writes in Region 1 automatically replicate to Region 2
Writes in Region 2 automatically replicate to Region 1

If Region 1 fails:
  Users automatically failover to Region 2
  All data already there (already replicated)
  Zero data loss
<details>
<summary>Click to view code</summary>

```

**Cache/state**:
```

</details>

Don't store session state locally
Use distributed cache: DynamoDB or Redis Cluster
  - Spans multiple regions
  - User session survives region failure
<details>
<summary>Click to view code</summary>

```

**Cost trade-off**:
```

</details>

Single region: $1M/month
Multi-region: $2M/month (2x cost)

Benefit: Can survive region failure
         Netflix generates $300M/day revenue
         Region outage = $12M/hour loss
         
2x cost is cheaper than 1 hour downtime
<details>
<summary>Click to view code</summary>

```

---

### Q5: How many load balancers do you need for 10M concurrent connections?

**Answer:**
**Calculation**:

```

</details>

Modern load balancer (AWS ALB):
- Max 25,000 new connections per second
- 1M concurrent connections per instance

For 10M concurrent connections:
- 10M / 1M = 10 load balancers needed

But add redundancy:
- 2 regions × 10 LBs = 20 LBs
- Each region can lose 1 LB without impact
- High availability
<details>
<summary>Click to view code</summary>

```

**LB architecture**:
```

</details>

DNS (Route 53)
    ↓
US East: LB1, LB2, LB3, LB4, LB5 (can lose 1)
US West: LB6, LB7, LB8, LB9, LB10 (can lose 1)

If LB1 fails:
  - Route 53 detects
  - Traffic → LB2-5 (4 LBs instead of 5)
  - Users unaffected
<details>
<summary>Click to view code</summary>

```

**Connection distribution**:
```

</details>

Each connection = one TCP flow through LB
LB tracks: source_ip, dest_ip, port

With 10M connections:
- ~1M per LB
- Memory per connection: ~1-2KB
- 1M × 2KB = 2GB per LB (acceptable)
```

**Why not one giant LB?**
- Single point of failure
- Geographic latency (users far away)
- Doesn't scale beyond 1M connections
