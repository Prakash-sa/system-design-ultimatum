# System Design Patterns - Complete Guide

## Introduction to Design Patterns

Design patterns are proven solutions to common problems in system design. They help teams:
- Solve problems consistently
- Communicate architecture clearly
- Avoid reinventing the wheel
- Scale systems predictably

---

## 1. CQRS (Command Query Responsibility Segregation)

**What is CQRS?**

Separate read and write operations into different models.

<details>
<summary>Click to view code</summary>

```
Traditional (One Model):
  ┌─────────────────┐
  │   User Model    │
  │ ┌─────────────┐ │
  │ │ Write (API) │ │ Update user name
  │ │ Read (API)  │ │ Get user profile
  │ └─────────────┘ │
  └─────────────────┘

CQRS (Separate Models):
  Command Model              Query Model
  (Write optimized)         (Read optimized)
  ┌──────────────┐          ┌─────────────┐
  │ User Write   │          │ User Read   │
  │ - Update DB  │──sync───→│ - Cached    │
  │ - Emit event │ (Kafka)  │ - Denorm    │
  └──────────────┘          │ - Indexed   │
                            └─────────────┘
```

</details>

### Pros
- Optimize reads and writes separately
- Scale read model independently (cache replicas)
- Better performance (read-optimized queries)
- Event sourcing naturally fits CQRS
- Different teams can own read vs write

### Cons
- Eventual consistency (reads lag behind writes)
- Complexity (maintain two models)
- Synchronization overhead
- More moving parts to operate

### When to Use
- Heavy read workloads (100:1 read-to-write ratio)
- Complex reporting/analytics queries
- Multiple clients with different read needs
- High-frequency writes with infrequent reads

### When NOT to Use
- Simple CRUD applications
- Strong consistency required
- Low volume systems (overhead not worth it)
- Team unfamiliar with event-driven systems

### Example: E-commerce Product Catalog

<details>
<summary>Click to view code (python)</summary>

```python
# Command Model (Write-optimized)
class ProductCommandHandler:
    def __init__(self, db):
        self.db = db
        self.event_bus = EventBus()
    
    def update_product_price(self, product_id, new_price):
        # Update write model
        self.db.update({
            'id': product_id,
            'price': new_price,
            'updated_at': now()
        })
        
        # Emit event for read model to consume
        self.event_bus.emit({
            'type': 'ProductPriceUpdated',
            'product_id': product_id,
            'new_price': new_price,
            'timestamp': now()
        })

# Query Model (Read-optimized)
class ProductQueryHandler:
    def __init__(self, cache, search_index):
        self.cache = cache
        self.search_index = search_index
        self.event_bus = EventBus()
    
    def on_product_price_updated(self, event):
        # Update cache with denormalized data
        product = self.cache.get(event['product_id'])
        product['price'] = event['new_price']
        self.cache.set(event['product_id'], product, ttl=3600)
        
        # Update search index
        self.search_index.update({
            'id': event['product_id'],
            'price': event['new_price']
        })
    
    def get_product(self, product_id):
        # Read from cache (super fast)
        return self.cache.get(product_id)
    
    def search_products(self, filters):
        # Query search index (optimized for this)
        return self.search_index.query(filters)

# Setup event sync
event_bus.subscribe('ProductPriceUpdated', product_query.on_product_price_updated)
```

</details>

---

## 2. Event Sourcing

**What is Event Sourcing?**

Store all state changes as immutable events. Reconstruct state by replaying events.

<details>
<summary>Click to view code</summary>

```
Traditional Database:
  User table:
  id | name  | email
  1  | John  | john@example.com
  (Only current state)

Event Sourcing:
  Event log:
  1. UserCreated(id=1, name="Alice", email="alice@example.com")
  2. UserNameChanged(id=1, name="John")
  3. UserEmailChanged(id=1, email="john@example.com")
  (Complete history)
```

</details>

### Pros
- Complete audit trail (HIPAA, financial compliance)
- Time-travel (reconstruct state at any point)
- Event-driven architecture naturally
- Debugging easier (see what happened)
- Microservices communication via events
- No N+1 query problem

### Cons
- Event versioning complexity
- Storage overhead (all events stored)
- Delayed consistency (eventually consistent)
- Learning curve (different mindset)
- Event handling order matters

### When to Use
- Compliance/audit requirements (financial, healthcare)
- Need to know "why" not just "what"
- Complex domain logic with many state transitions
- Want to understand system history

### When NOT to Use
- Simple CRUD (overkill)
- Real-time strong consistency critical
- Team not experienced with event-driven
- Storage is constraint (massive event volume)

### Example: Bank Account

<details>
<summary>Click to view code (python)</summary>

```python
class BankAccount:
    def __init__(self, account_id):
        self.account_id = account_id
        self.events = []
        self.balance = 0
    
    def deposit(self, amount):
        self.balance += amount
        self.events.append({
            'type': 'MoneyDeposited',
            'amount': amount,
            'timestamp': now(),
            'balance_after': self.balance
        })
    
    def withdraw(self, amount):
        if self.balance < amount:
            raise InsufficientFunds()
        
        self.balance -= amount
        self.events.append({
            'type': 'MoneyWithdrawn',
            'amount': amount,
            'timestamp': now(),
            'balance_after': self.balance
        })
    
    def get_current_balance(self):
        return self.balance
    
    def get_history(self):
        """Audit trail: all transactions"""
        return self.events

# Persistence
def save_account(account):
    for event in account.events:
        event_store.append(event)

def load_account(account_id):
    events = event_store.get_all(account_id)
    account = BankAccount(account_id)
    
    # Replay events to reconstruct state
    for event in events:
        if event['type'] == 'MoneyDeposited':
            account.balance += event['amount']
        elif event['type'] == 'MoneyWithdrawn':
            account.balance -= event['amount']
    
    return account

# Time-travel: state at specific date
def get_balance_on_date(account_id, date):
    events = event_store.get_all(account_id)
    balance = 0
    
    for event in events:
        if event['timestamp'] <= date:
            if event['type'] == 'MoneyDeposited':
                balance += event['amount']
            elif event['type'] == 'MoneyWithdrawn':
                balance -= event['amount']
    
    return balance
```

</details>

---

## 3. Saga Pattern (Distributed Transactions)

**What is Saga?**

Coordinate multi-step transactions across services without distributed locks.

<details>
<summary>Click to view code</summary>

```
Traditional (2-phase commit):
  Service A       Coordinator       Service B
     │                │                 │
     │ Prepare ────────→                │
     │◄────────────────ack              │
     │                │───Prepare──────→
     │                │◄───────ack──────
     │                │                 │
     │ Commit ────────→                 │
     │◄────────────────ack              │
     │                │───Commit──────→
     │                │◄───────ack──────

Saga (Event-driven):
  Service A           Service B
     │                   │
  [Book flight] ──event──→
     │                [Reserve hotel]
     │◄──event────────
  [Confirm]          [Confirm]
```

</details>

### Two Types of Sagas

**Choreography** (services listen to events):
<details>
<summary>Click to view code (python)</summary>

```python
# Service A (Flight Booking)
def book_flight(booking_id, flight):
    flight.reserve(booking_id)
    event_bus.emit('FlightBooked', booking_id)

# Service B (Hotel Booking)
def on_flight_booked(event):
    hotel.reserve(event.booking_id)
    event_bus.emit('HotelBooked', event.booking_id)

# Service C (Payment)
def on_hotel_booked(event):
    payment.charge(event.booking_id)
    event_bus.emit('PaymentProcessed', event.booking_id)
```

</details>

**Orchestration** (central coordinator):
<details>
<summary>Click to view code (python)</summary>

```python
class BookingOrchestrator:
    def book_trip(self, booking_id, flight, hotel):
        try:
            # Step 1: Book flight
            self.flight_service.book(booking_id, flight)
            
            # Step 2: Book hotel
            self.hotel_service.book(booking_id, hotel)
            
            # Step 3: Process payment
            self.payment_service.charge(booking_id)
            
            return 'SUCCESS'
        except FlightUnavailable:
            return 'FLIGHT_FAILED'
        except HotelUnavailable:
            # Compensate: cancel flight
            self.flight_service.cancel(booking_id)
            return 'HOTEL_FAILED'
        except PaymentFailed:
            # Compensate: cancel flight, cancel hotel
            self.flight_service.cancel(booking_id)
            self.hotel_service.cancel(booking_id)
            return 'PAYMENT_FAILED'
```

</details>

### Pros
- No distributed locks (more scalable)
- Works across services naturally
- Easy to understand flow (choreography)
- Compensating transactions clear

### Cons
- Complex to implement
- Eventual consistency
- Debugging difficult (distributed)
- Compensating transactions may fail

### When to Use
- Multi-service transactions (microservices)
- Eventual consistency acceptable
- Services independently scalable
- Order management, booking systems

### When NOT to Use
- Strong ACID required
- Simple single-service transactions
- Compensations too complex/expensive
- Real-time consistency critical

---

## 4. Circuit Breaker Pattern

**What is Circuit Breaker?**

Prevent cascading failures by stopping calls to failing service.

<details>
<summary>Click to view code</summary>

```
Service A → Service B (slow)
           (timeout)
           (timeout)
           (timeout)
           → Circuit OPEN (stop calling)
           → Return error immediately
           (wait 30 seconds)
           → Try once (HALF-OPEN)
           (success)
           → Circuit CLOSED (normal)
```

</details>

### States

<details>
<summary>Click to view code</summary>

```
CLOSED: Normal operation
  Requests pass through
  Count failures
  If failures > threshold → OPEN

OPEN: Service failing
  Requests rejected immediately (fail fast)
  Return cached response or error
  After timeout → HALF-OPEN

HALF-OPEN: Testing service
  Allow one request
  If success → CLOSED
  If failure → OPEN (restart timeout)
```

</details>

### Implementation

<details>
<summary>Click to view code (python)</summary>

```python
import time
from enum import Enum

class CircuitState(Enum):
    CLOSED = 'closed'
    OPEN = 'open'
    HALF_OPEN = 'half_open'

class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failures = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
    
    def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.timeout:
                self.state = CircuitState.HALF_OPEN
                self.failures = 0
            else:
                raise CircuitBreakerOpen()
        
        try:
            result = func(*args, **kwargs)
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise
    
    def on_success(self):
        self.failures = 0
        self.state = CircuitState.CLOSED
    
    def on_failure(self):
        self.failures += 1
        self.last_failure_time = time.time()
        
        if self.failures >= self.failure_threshold:
            self.state = CircuitState.OPEN

# Usage
breaker = CircuitBreaker(failure_threshold=5, timeout=30)

def call_payment_service():
    try:
        return breaker.call(payment_api.charge, amount=100)
    except CircuitBreakerOpen:
        return {'status': 'cached', 'amount': 100}  # Cached response
```

</details>

### Pros
- Prevents cascading failures
- Fail fast (immediate error vs timeout)
- Allows service recovery time
- Simple to implement

### Cons
- Need fallback behavior
- Deciding thresholds tricky
- Monitoring needed

### When to Use
- Calling external/unreliable services
- Prevent cascading failures
- High volume systems

---

## 5. Bulkhead Pattern

**What is Bulkhead?**

Isolate resources so failure in one doesn't affect others.

<details>
<summary>Click to view code</summary>

```
Traditional (Shared resources):
  Thread pool (100 threads)
    ├─ Service A (uses 80 threads)
    │  (slow, all threads blocked)
    ├─ Service B (2 threads left)
    │  (blocked, can't process)
    └─ Service C (0 threads)
       (queued, timeout)

Bulkhead (Separate pools):
  Service A pool (40 threads) - isolated
  Service B pool (30 threads) - isolated
  Service C pool (30 threads) - isolated
  
  Service A slow → Doesn't affect B, C
```

</details>

### Implementation

<details>
<summary>Click to view code (python)</summary>

```python
from concurrent.futures import ThreadPoolExecutor

class BulkheadExecutor:
    def __init__(self):
        self.service_a_pool = ThreadPoolExecutor(max_workers=40)
        self.service_b_pool = ThreadPoolExecutor(max_workers=30)
        self.service_c_pool = ThreadPoolExecutor(max_workers=30)
    
    def call_service_a(self, func):
        return self.service_a_pool.submit(func)
    
    def call_service_b(self, func):
        return self.service_b_pool.submit(func)

# Even if service A is slow:
# Service B and C can still process
executor = BulkheadExecutor()
executor.call_service_a(slow_func)  # Blocks 40 threads
executor.call_service_b(fast_func)  # Uses separate 30 threads (not affected)
```

</details>

### Pros
- Isolates failures
- Predictable latency
- Resource control

### Cons
- More thread/connection overhead
- Resource tuning needed

### When to Use
- Multiple external dependencies
- Need isolation for reliability

---

## 6. Retry Pattern with Exponential Backoff

**What is Retry?**

Automatically retry failed requests with increasing delays.

<details>
<summary>Click to view code</summary>

```
Attempt 1: 0ms delay
  → Fails

Attempt 2: 100ms delay
  → Fails

Attempt 3: 300ms delay
  → Fails

Attempt 4: 900ms delay
  → Success

Formula: delay = base_delay × (multiplier ^ attempt)
```

</details>

### Implementation

<details>
<summary>Click to view code (python)</summary>

```python
import time
import random

def retry_with_backoff(func, max_retries=3, base_delay=100, multiplier=2):
    """
    Args:
        base_delay: milliseconds
        multiplier: exponential growth
    """
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            
            # Calculate delay
            delay_ms = base_delay * (multiplier ** attempt)
            
            # Add jitter (prevent thundering herd)
            jitter = random.uniform(0, delay_ms * 0.1)
            delay_ms += jitter
            
            print(f"Attempt {attempt + 1} failed. Retrying in {delay_ms}ms")
            time.sleep(delay_ms / 1000)

# Usage
def call_api():
    return requests.post('https://api.example.com/payment', data)

retry_with_backoff(call_api)
```

</details>

### When to Use
- Network calls (transient failures)
- Database connections
- Idempotent operations only

### When NOT to Use
- Non-idempotent operations (charge user twice)
- Permanent errors (404, 403)

---

## 7. Eventual Consistency Pattern

**What is Eventual Consistency?**

Data is not immediately consistent but becomes consistent over time.

<details>
<summary>Click to view code</summary>

```
Strong Consistency (ACID):
  Write ──→ [wait] ──→ Read
  Always see latest data

Eventual Consistency:
  Write ──→ Returns immediately
           │
           └─→ [propagate to replicas]
                (1 second later)
           
  Read (might get old data)
  Read (after 1 second)
  → See updated data
```

</details>

### Pros
- Higher availability
- Better performance (no locks)
- Scales better

### Cons
- Temporary inconsistency
- Complex application logic
- Difficult to test

### When to Use
- High availability required
- Can tolerate stale data (social media likes)
- Distributed systems

### When NOT to Use
- Financial transactions
- Strong consistency critical
- Low tolerance for inconsistency

---

## 8. Sharding Pattern (Data Partitioning)

**What is Sharding?**

Partition data across multiple databases (range, hash, directory-based).

<details>
<summary>Click to view code</summary>

```
Hash-based sharding:
  user_id = 123
  shard = hash(user_id) % num_shards
  shard = hash(123) % 4 = 3
  → Store in Shard 3 DB

Users:
  ├─ Shard 0 (user_id % 4 == 0)
  ├─ Shard 1 (user_id % 4 == 1)
  ├─ Shard 2 (user_id % 4 == 2)
  └─ Shard 3 (user_id % 4 == 3)
```

</details>

### Sharding Strategies

| Strategy | Method | Use Case |
|----------|--------|----------|
| **Range** | user_id 1-1000M → Shard 0 | Simple but uneven |
| **Hash** | hash(user_id) % num_shards | Even distribution |
| **Directory** | lookup table: user_id → shard | Flexible rebalancing |
| **Geo** | user location → shard | GDPR compliance |

### Pros
- Scales horizontally
- Independent scaling per shard
- Parallel processing

### Cons
- Complex queries (may need multiple shards)
- Rebalancing hard (reshuffling data)
- Distributed transactions

### When to Use
- Data too large for single database
- Need horizontal scaling
- Can tolerate sharding key

### When NOT to Use
- Small datasets (overkill)
- Frequent resharding needed
- Complex cross-shard queries

---

## 9. Cache-Aside Pattern

**What is Cache-Aside (Lazy Loading)?**

Check cache first; load from database if miss.

<details>
<summary>Click to view code</summary>

```
Read request:
  1. Check cache
     - Hit: return cached data
     - Miss: continue
  2. Load from database
  3. Store in cache (for future reads)
  4. Return to client
```

</details>

### Implementation

<details>
<summary>Click to view code (python)</summary>

```python
def get_user(user_id):
    # Step 1: Check cache
    cached = cache.get(f'user:{user_id}')
    if cached:
        return cached
    
    # Step 2: Load from database
    user = db.query(f'SELECT * FROM users WHERE id = {user_id}')
    
    if user:
        # Step 3: Store in cache
        cache.set(f'user:{user_id}', user, ttl=3600)
    
    # Step 4: Return
    return user
```

</details>

### Pros
- Simple to implement
- No cache invalidation issues
- Lazy loading (only cache what's needed)

### Cons
- Cache misses cause latency spike
- Stale data possible (after TTL)
- Write-through not handled

### When to Use
- Read-heavy workloads
- Acceptable staleness (TTL)
- Simple caching

---

## 10. Write-Through Pattern

**What is Write-Through?**

Write to both cache and database simultaneously.

<details>
<summary>Click to view code</summary>

```
Write request:
  1. Write to cache
  2. Write to database
  3. Return to client (when both succeed)
```

</details>

### Pros
- Cache always up-to-date
- Strong consistency

### Cons
- Write latency (wait for both)
- Complexity

### When to Use
- Strong consistency required
- Write-heavy workloads

---

## 11. Multi-Tenancy Pattern

**What is Multi-Tenancy?**

Single application instance serves multiple customers (tenants).

<details>
<summary>Click to view code</summary>

```
Separate Database per Tenant (Most secure):
  Tenant A DB
  Tenant B DB
  Tenant C DB
  
Shared Database, Separate Schema:
  Shared DB
  ├─ tenant_a schema
  ├─ tenant_b schema
  └─ tenant_c schema

Shared Database, Shared Schema (most cost-efficient):
  Shared DB
  ├─ User table (tenant_id column)
  ├─ Post table (tenant_id column)
  └─ Comment table (tenant_id column)
```

</details>

### Isolation Levels

| Strategy | Cost | Security | Isolation | Use Case |
|----------|------|----------|-----------|----------|
| **Separate DB** | High | Highest | Complete | Healthcare, finance |
| **Separate Schema** | Medium | High | Row-level | SaaS platforms |
| **Shared DB** | Low | Medium | Row-level | Internal tools |

### Pros
- Cost efficient
- Resource sharing

### Cons
- Complex queries (tenant_id filtering needed)
- Security risk (row-level access control critical)
- Noisy neighbor problem

### When to Use
- SaaS products
- Cost optimization
- Predictable tenant isolation

---

## 12. API Gateway Pattern

**What is API Gateway?**

Single entry point for all client requests.

<details>
<summary>Click to view code</summary>

```
Without API Gateway:
  Client 1 ──→ Service A
  Client 2 ──→ Service B
  Client 3 ──→ Service C
  (Each client knows all services)

With API Gateway:
  Client 1 ──┐
  Client 2 ──→ API Gateway ──→ Service A
  Client 3 ──┘                ──→ Service B
                              ──→ Service C
```

</details>

### Responsibilities

<details>
<summary>Click to view code (python)</summary>

```python
class APIGateway:
    def handle_request(self, request):
        # 1. Authentication
        user = self.auth.verify(request.token)
        
        # 2. Rate limiting
        if self.rate_limiter.is_exceeded(user.id):
            return {'error': 'Rate limit exceeded'}
        
        # 3. Routing
        service = self.route(request.path)
        
        # 4. Request transformation
        transformed = self.transform(request)
        
        # 5. Call service
        response = service.call(transformed)
        
        # 6. Response transformation
        return self.transform_response(response)
```

</details>

### Pros
- Centralized authentication
- Rate limiting
- Request/response transformation
- Service discovery

### Cons
- Single point of failure
- Performance bottleneck
- Operational complexity

### When to Use
- Microservices architecture
- Need centralized auth
- Complex routing logic

---

## 13. Strangler Fig Pattern (Monolith Migration)

**What is Strangler Fig?**

Gradually migrate monolith to microservices by intercepting requests.

<details>
<summary>Click to view code</summary>

```
Phase 1: Old system operates normally
  Clients → Monolith

Phase 2: New service added, intercept some requests
  Clients → API Gateway ──→ New Service (15% traffic)
                         └─→ Monolith (85% traffic)

Phase 3: More functionality migrated
  Clients → API Gateway ──→ Service A (50% traffic)
                         ├─→ Service B
                         └─→ Monolith (50% traffic)

Phase 4: Complete migration
  Clients → API Gateway ──→ Service A
                         ├─→ Service B
                         ├─→ Service C
                         └─→ (Monolith decommissioned)
```

</details>

### Pros
- Low risk (rollback easy)
- Gradual testing
- Continuous delivery

### Cons
- Dual maintenance (old + new)
- Complex routing logic
- Longer migration time

### When to Use
- Large monolith migration
- Can't afford downtime
- High-risk systems

---

## Interview Questions & Answers

### Q1: Design Instagram with CQRS and Event Sourcing.

**Answer:**

**Architecture:**

<details>
<summary>Click to view code</summary>

```
Write Path (Commands):
  User posts photo
    ↓
  PostService.CreatePost(userId, imageUrl, caption)
    ├─ Save to write DB
    ├─ Emit "PostCreated" event
    └─ Return to client (fast)

Read Path (Queries):
  User views feed
    ↓
  FeedService.GetUserFeed(userId)
    ├─ Query read cache
    └─ Return (super fast)

Event Processing:
  PostCreated event
    ↓
  Update denormalized feed tables
    ├─ Add to user's followers' feeds
    ├─ Update search index
    ├─ Update user's post count
    └─ Send notification (async)
```

</details>

**Implementation:**

<details>
<summary>Click to view code (python)</summary>

```python
class Post:
    def __init__(self):
        self.events = []
    
    def create_post(self, user_id, image_url, caption):
        event = {
            'type': 'PostCreated',
            'user_id': user_id,
            'image_url': image_url,
            'caption': caption,
            'timestamp': now(),
            'likes': 0,
            'comments': 0
        }
        self.events.append(event)
        event_bus.emit(event)
    
    def like_post(self, user_id, post_id):
        event = {
            'type': 'PostLiked',
            'post_id': post_id,
            'user_id': user_id,
            'timestamp': now()
        }
        self.events.append(event)
        event_bus.emit(event)

class FeedReadModel:
    def on_post_created(self, event):
        # Get followers
        followers = self.get_followers(event['user_id'])
        
        # Add post to each follower's feed
        for follower_id in followers:
            self.feed_cache.add_to_feed(
                follower_id,
                event['post_id'],
                score=event['timestamp']  # For ranking
            )
    
    def on_post_liked(self, event):
        # Update like count in cache
        post = self.feed_cache.get_post(event['post_id'])
        post['likes'] += 1
        self.feed_cache.update_post(post)
    
    def get_user_feed(self, user_id, limit=20):
        # Read from cache (super fast)
        return self.feed_cache.get_feed(user_id, limit)

# Setup
event_bus.subscribe('PostCreated', feed_model.on_post_created)
event_bus.subscribe('PostLiked', feed_model.on_post_liked)
```

</details>

**Benefits:**
- Write path fast (just persist event)
- Read path fast (pre-computed cache)
- Event replay (rebuild cache)
- Complete audit trail

---

### Q2: How would you handle saga pattern for payment processing with multiple services?

**Answer:**

**Services involved:**
1. Order Service (creates order)
2. Payment Service (charges card)
3. Inventory Service (deducts stock)
4. Shipping Service (creates shipment)

**Orchestration approach:**

<details>
<summary>Click to view code (python)</summary>

```python
class OrderSaga:
    def __init__(self):
        self.order_service = OrderService()
        self.payment_service = PaymentService()
        self.inventory_service = InventoryService()
        self.shipping_service = ShippingService()
    
    def execute_order(self, order_id, user_id, items, card):
        try:
            # Step 1: Create order
            order = self.order_service.create(order_id, user_id, items)
            if not order:
                raise OrderCreationFailed()
            
            # Step 2: Charge payment
            payment = self.payment_service.charge(
                user_id, 
                amount=order.total,
                card=card
            )
            if payment.status != 'SUCCESS':
                raise PaymentFailed()
            
            # Step 3: Reserve inventory
            inventory = self.inventory_service.reserve(items)
            if not inventory:
                # Compensate: refund payment
                self.payment_service.refund(payment.id)
                raise InventoryUnavailable()
            
            # Step 4: Create shipment
            shipment = self.shipping_service.create_shipment(order_id)
            if not shipment:
                # Compensate
                self.payment_service.refund(payment.id)
                self.inventory_service.release(items)
                raise ShipmentFailed()
            
            # SUCCESS
            self.order_service.mark_complete(order_id)
            return {'status': 'SUCCESS', 'order_id': order_id}
        
        except PaymentFailed:
            # Compensate: nothing to do
            self.order_service.mark_failed(order_id)
            return {'status': 'FAILED', 'reason': 'Payment failed'}
        
        except InventoryUnavailable:
            # Compensate: refund payment
            # (already done in try block)
            self.order_service.mark_failed(order_id)
            return {'status': 'FAILED', 'reason': 'Inventory unavailable'}
        
        except ShipmentFailed:
            # Compensate: refund, release inventory
            # (already done in try block)
            self.order_service.mark_failed(order_id)
            return {'status': 'FAILED', 'reason': 'Shipment creation failed'}
```

</details>

**Key points:**
- Each service must be idempotent (safe to retry)
- Compensating transactions must be reliable
- Consider timeout for long-running operations

---

### Q3: Design circuit breaker for external payment gateway with fallback.

**Answer:**

<details>
<summary>Click to view code (python)</summary>

```python
class PaymentGatewayClient:
    def __init__(self):
        self.breaker = CircuitBreaker(
            failure_threshold=5,
            timeout=60  # seconds
        )
        self.cache = Cache()
    
    def charge(self, user_id, amount, card):
        try:
            # Try payment gateway (with circuit breaker)
            return self.breaker.call(
                self._call_gateway,
                user_id,
                amount,
                card
            )
        
        except CircuitBreakerOpen:
            # Fallback 1: Queue for async processing
            self._queue_payment(user_id, amount, card)
            return {'status': 'QUEUED'}
        
        except PaymentGatewayError as e:
            # Fallback 2: Return cached previous transaction
            if e.code == 'TIMEOUT':
                cached = self.cache.get(f'last_charge:{user_id}')
                if cached and cached['amount'] == amount:
                    return cached  # Assume success
                else:
                    raise
            
            raise
    
    def _call_gateway(self, user_id, amount, card):
        """Actual payment gateway call"""
        response = requests.post(
            'https://payment-gateway.com/charge',
            json={
                'user_id': user_id,
                'amount': amount,
                'card': card
            },
            timeout=5  # Short timeout to fail fast
        )
        
        if response.status_code == 200:
            result = response.json()
            # Cache successful transaction
            self.cache.set(
                f'last_charge:{user_id}',
                result,
                ttl=3600
            )
            return result
        else:
            raise PaymentGatewayError(response.status_code)
    
    def _queue_payment(self, user_id, amount, card):
        """Async processing when circuit is open"""
        queue.push({
            'type': 'pending_payment',
            'user_id': user_id,
            'amount': amount,
            'card': card,
            'queued_at': now()
        })
        # Worker service processes queue asynchronously
```

</details>

---

### Q4: Design sharding strategy for a social network with 1B users.

**Answer:**

**Requirements:**
- 1 billion users
- Read-heavy (billions of requests/day)
- Need to distribute across regions

**Sharding strategy: Hash-based + Geo-replication**

<details>
<summary>Click to view code (python)</summary>

```python
class UserShardingManager:
    def __init__(self, num_shards=256):
        self.num_shards = num_shards
        self.shards = {}  # shard_id → DbConnection
        
        # Initialize shards
        for i in range(num_shards):
            self.shards[i] = Database(f'shard_{i}')
    
    def get_shard_id(self, user_id):
        """Consistent hashing"""
        return hash(user_id) % self.num_shards
    
    def get_shard(self, user_id):
        shard_id = self.get_shard_id(user_id)
        return self.shards[shard_id]
    
    def create_user(self, user_id, user_data):
        shard = self.get_shard(user_id)
        shard.insert('users', {
            'user_id': user_id,
            **user_data
        })
    
    def get_user(self, user_id):
        shard = self.get_shard(user_id)
        return shard.query(
            'SELECT * FROM users WHERE user_id = %s',
            [user_id]
        )

# Geo-replication
class GeoDistributedShards:
    def __init__(self):
        self.us_east = ShardingManager(256)
        self.eu_west = ShardingManager(256)
        self.ap_south = ShardingManager(256)
    
    def get_shard_by_region(self, user_id, region):
        if region == 'us':
            return self.us_east.get_shard(user_id)
        elif region == 'eu':
            return self.eu_west.get_shard(user_id)
        else:
            return self.ap_south.get_shard(user_id)

# Schema per shard
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    name VARCHAR,
    region VARCHAR,
    created_at TIMESTAMP,
    INDEX (created_at)
);

# Cross-shard queries (problematic)
def search_by_name(name):
    # Must query all shards (256 queries!)
    results = []
    for shard in shards:
        results.extend(shard.query(
            'SELECT * FROM users WHERE name LIKE %s',
            [f'{name}%']
        ))
    return results

# Solution: Denormalized search index
class UserSearchIndex:
    def __init__(self):
        self.elasticsearch = Elasticsearch()
    
    def index_user(self, user_id, user_data):
        # Index in search engine (across shards)
        self.elasticsearch.index(
            index='users',
            id=user_id,
            body=user_data
        )
    
    def search_by_name(self, name):
        return self.elasticsearch.search(
            index='users',
            body={'query': {'match': {'name': name}}}
        )
```

</details>

**Data distribution:**
<details>
<summary>Click to view code</summary>

```
1B users ÷ 256 shards = ~4M users per shard
Each shard DB:
  - Data: ~4 billion users/shard
  - Read replicas (3x) for read scaling
  - ~100GB per shard (reasonable)

Traffic:
  1B users × 10 requests/day = 10B requests/day
  ÷ 256 shards = ~40M requests/shard/day (manageable)
```

</details>

---

### Q5: Design system migration from monolith to microservices using strangler pattern.

**Answer:**

**Phases:**

<details>
<summary>Click to view code</summary>

```
Phase 1 (Week 1-2): Add API Gateway
  Old: Client → Monolith (100%)
  New: Client → API Gateway → Monolith (100%)
  Purpose: Prepare routing infrastructure

Phase 2 (Week 3-4): Extract first microservice
  Extract: User Service
  Routing: 
    - /api/users* → User Service
    - Everything else → Monolith
  Traffic: User Service (10%), Monolith (90%)
  Test thoroughly before increasing traffic

Phase 3 (Week 5-6): Increase User Service traffic
  Traffic: User Service (50%), Monolith (50%)
  Dual-write: Write to both DBs during transition

Phase 4 (Week 7-12): Extract remaining services
  Extract: Post Service
  Extract: Comment Service
  Extract: Feed Service
  Traffic gradually shifts to microservices
  
Phase 5 (Week 13+): Decommission monolith
  Monolith: Read-only (for reference)
  Microservices: 100% traffic
  Finally: Remove monolith code
```

</details>

**Implementation:**

<details>
<summary>Click to view code (python)</summary>

```python
class APIGateway:
    def route_request(self, request):
        path = request.path
        
        # Phase 1: All to monolith
        # return self.call_monolith(request)
        
        # Phase 2: Route by path
        if path.startswith('/api/users'):
            return self.call_microservice('user-service', request)
        elif path.startswith('/api/posts'):
            if self.should_use_new_service('post-service'):
                return self.call_microservice('post-service', request)
        
        # Fallback to monolith
        return self.call_monolith(request)
    
    def should_use_new_service(self, service_name):
        """Gradual traffic shift"""
        if service_name == 'post-service':
            # Shift 10% → 25% → 50% → 100%
            traffic_percentage = self.get_traffic_percentage(service_name)
            return random.random() < traffic_percentage

class DataSyncManager:
    def __init__(self):
        self.monolith_db = MonolithDB()
        self.user_service_db = UserServiceDB()
    
    def create_user(self, user_data):
        # Dual write during transition
        
        # Write to monolith
        user_monolith = self.monolith_db.create_user(user_data)
        
        # Write to user service
        try:
            user_service = self.user_service_db.create_user(user_data)
        except Exception as e:
            # Log but don't fail (eventually consistent)
            log.warn(f"Failed to write to user service: {e}")
            # Background job will sync later
        
        return user_monolith
    
    def sync_background():
        """Periodic sync for failed writes"""
        for user in monolith_db.get_all_users():
            if not user_service_db.exists(user.id):
                user_service_db.create_user(user)
```

</details>

**Risk mitigation:**
- Dual reads to compare results
- Monitoring and rollback capability
- Gradual traffic shifting
- Feature flags for quick rollback

