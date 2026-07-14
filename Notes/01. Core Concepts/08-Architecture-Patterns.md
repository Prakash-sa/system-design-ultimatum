# Architecture Patterns

## Monolith vs Microservices

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

## Architecture Evolution

<details>
<summary>Click to view code</summary>

```
Stage 1: Monolith (startup)
- Single codebase
- Simple deployment
- Easy to test

Stage 2: Modular Monolith
- Well-defined modules
- Clean separation of concerns
- Still single deployment

Stage 3: Microservices
- Separate services
- Independent scaling
- Team autonomy
- Operational complexity
```

</details>

---

## Monolith Architecture

**Structure**:
<details>
<summary>Click to view code</summary>

```
User API ── Business Logic ── Database
│           │
├─ Auth     ├─ User service
├─ Profile  ├─ Order service
├─ Orders   └─ Payment service
└─ Payments
```

</details>

**Pros:**
- Simple to deploy (1 binary)
- Easy debugging (single codebase)
- Good performance (in-process calls)
- Simple testing

**Cons:**
- Technology lock-in (all services use same language/framework)
- Scaling limitations (scale entire app even if only auth needed)
- Risk: One bug crashes everything
- Harder to parallelize development (large team)

**Best for:**
- Startups (MVP, < 50K LOC)
- Simple domains
- Small teams (< 10 engineers)
- Performance-critical (gaming, trading)

---

## Microservices Architecture

**Structure**:
<details>
<summary>Click to view code</summary>

```
Load Balancer
    ↓
API Gateway
    ├─ User Service (Node.js)
    ├─ Order Service (Python)
    ├─ Payment Service (Java)
    └─ Notification Service (Go)
    
Each service:
- Own database
- Own deployment
- Own scaling
```

</details>

**Pros:**
- Independent scaling
- Technology flexibility
- Team autonomy
- Loose coupling (easy to replace services)
- Fault isolation

**Cons:**
- Operational complexity (10+ services = 10x complexity)
- Distributed tracing / debugging harder
- Network latency (RPC calls vs in-process)
- Data consistency (no ACID across services)
- Testing complexity (integration tests)

**Best for:**
- Mature companies
- Large teams (Google, Netflix, Amazon)
- Complex domains with distinct services
- Different scaling needs per service

---

## When to Migrate from Monolith to Microservices

**Red flags**:
1. **Deployment bottleneck**: Can't deploy independently
   - Small change to auth → full system rebuild/test
   
2. **Scaling inefficiency**: Scale entire app for one component
   - Need 100 order-service instances, but only 10 payment instances
   
3. **Technology blocked**: Want to use different tech
   - New team wants Go, forced to use Java
   
4. **Team scaling blocked**: Too many developers on same codebase
   - Merge conflicts, coordination overhead

**Don't migrate if**:
- Team < 20 engineers
- < 100K lines of code
- No complex scaling requirements
- Simple domain (CRUD app)
- Deployment frequency < daily

---

## Interview Questions & Answers

### Q1: You've got a monolith with 500K LOC. Migrate to microservices?

**Answer:**
**Yes, but in phases**:

**Phase 1: Extract obvious services** (3-6 months)
- Payment service (external dependency)
- Notification service (async, isolated)
- User service (clear boundary)

Remaining monolith handles: Orders, Products, Recommendations

**Phase 2: Monitor & iterate** (6-12 months)
- See if extracted services work
- Ops overhead manageable?
- Team velocity improved?
- Cost acceptable?

**Phase 3: Decide further extraction** (1-2 years)
- If yes → Extract more services (Order, Product)
- If no → Stay hybrid (keep some as monolith)

**Why phased?**
<details>
<summary>Click to view code</summary>

```
Don't rewrite everything at once (Amazon failed this way)

Better approach:
- Extract highest pain services first
- Learn from each extraction
- Build expertise gradually
- Keep ability to rollback
```

</details>

**Cost analysis**:
<details>
<summary>Click to view code</summary>

```
Monolith maintenance: $1M/year
Microservices infra: $500K/year (better scaling)
Microservices ops: $2M/year (more complex)
Net cost increase: $1.5M/year

Benefit: Can deploy 100x faster, scale independently
Worth it if: Development bottleneck > ops cost
```

</details>

---

### Q2: How do you handle data consistency across microservices?

**Answer:**
**Three approaches** (tradeoffs):

**1. Synchronous (Strong consistency)**
<details>
<summary>Click to view code</summary>

```
Order service → synchronously calls → Payment service
             → synchronously calls → Inventory service

If any fails: Roll back all (distributed transaction)

Pros: Strong consistency
Cons: Coupling, cascading failures, complex
```

</details>

**2. Eventual consistency (Async)** ← Recommended
<details>
<summary>Click to view code</summary>

```
Order service publishes "order.created"
  ↓
Payment service listens → charges card
  ↓
Inventory service listens → decrements stock
  ↓
Email service listens → sends confirmation

If payment fails:
  - Publish "order.payment_failed"
  - Inventory, email services react
  
Takes seconds to converge, but eventually consistent
```

</details>

**3. Saga pattern** (distributed transaction)
<details>
<summary>Click to view code</summary>

```
Order service:
  1. Create order (PENDING)
  2. Call payment service
  3. If success → call inventory service
  4. If any fail → compensate (undo previous steps)

Orchestrated saga:
  Order service → tells Payment to charge
             → tells Inventory to decrement
             → handles rollback if needed

Choreography saga:
  Order publishes event → Payment listens, charges
                       → Inventory listens, decrements
                       → Each publishes own events
```

</details>

**Best practice**: **Async eventual consistency**
- Loosely coupled
- Resilient (services can be down)
- Scalable (no blocking calls)
- More operational complexity (need monitoring)

**Example**:
<details>
<summary>Click to view code (python)</summary>

```python
# Order service
def create_order(user_id, items):
    order = db.create_order(user_id, items, status="PENDING")
    
    # Publish event (async)
    queue.publish("order.created", {
        "order_id": order.id,
        "user_id": user_id,
        "items": items
    })
    
    return order

# Payment service (listens to order.created)
def handle_order_created(event):
    order_id = event['order_id']
    try:
        charge_card(user_id, amount)
        queue.publish("order.payment_succeeded", {"order_id": order_id})
    except PaymentError:
        queue.publish("order.payment_failed", {"order_id": order_id})

# Inventory service (listens to order.payment_succeeded)
def handle_payment_succeeded(event):
    order_id = event['order_id']
    for item in get_order_items(order_id):
        decrement_inventory(item)
    queue.publish("order.inventory_updated", {"order_id": order_id})
```

</details>

---

### Q3: Design Netflix microservices. How many services?

**Answer:**
**Netflix-like architecture**:

<details>
<summary>Click to view code</summary>

```
API Gateway (routes requests)
    ├─ Video Catalog Service
    │  └─ Get videos, metadata, genres
    │
    ├─ Recommendation Service
    │  └─ ML-powered recommendations
    │
    ├─ User Profile Service
    │  └─ Preferences, watch history, settings
    │
    ├─ Payment Service
    │  └─ Billing, subscriptions, payments
    │
    ├─ Content Delivery Service
    │  └─ Video streaming, adaptive bitrate
    │
    ├─ Notification Service
    │  └─ Email, push, SMS
    │
    ├─ Search Service
    │  └─ Elasticsearch-backed search
    │
    └─ Analytics Service
       └─ User behavior, metrics
```

</details>

**Services**: ~15-20 (Netflix actual: 700+)

**Why so many?**
- Different scaling needs
- Different technologies
- Different teams (Amazon's rule: 1 team per service)
- Independent deployments

**Why fewer in practice?**
- Coordination overhead
- Data consistency complexity
- Monitoring/debugging harder
- Testing (integration tests)

**Rule of thumb**:
- Start: 1-3 services
- Growth: 5-10 services per team
- Netflix scale: 1 service per team

---

### Q4: Monolith takes 2 hours to deploy. Microservices take 5 minutes per service. Worth it?

**Answer:**
**Depends on deployment frequency**:

<details>
<summary>Click to view code</summary>

```
Scenario 1: Deploy once per month
- Monolith: 1 deploy × 2 hours = 2 hours downtime/month
- Microservices: 20 deploys × 5 min = 100 min downtime/month
- Microservices WORSE (5x more downtime)

Scenario 2: Deploy 10 times per day
- Monolith: 10 × 2 hours = 20 hours downtime/day (IMPOSSIBLE)
- Microservices: 10 × 5 min = 50 min downtime/day (acceptable)
- Microservices BETTER (enables frequent deployments)

Scenario 3: Deploy independently (ideal)
- Monolith: Can't (all changes together)
- Microservices: Each team deploys independently
  - Team A deploys every hour
  - Team B deploys weekly
  - No coordination needed
- Microservices MUCH BETTER
```

</details>

**Real cost**:
<details>
<summary>Click to view code</summary>

```
Microservices operational overhead:
- 15 services × 3 engineers per service = 45 engineers
- Distributed tracing, monitoring, logging
- Incident response (failures in distributed system)
- Total ops cost: $5M/year

Monolith development productivity:
- 50 engineers, but coordination overhead
- Merge conflicts, deployments blocked
- Release cycle: 2 weeks
- Time to market: slow

If: Time to market worth $5M/year → Microservices
If: Operational simplicity matters → Monolith

Netflix answer: Time to market >> ops cost
We'll take the $5M/year to deploy 100x faster
```

</details>

**Recommendation**: Stick with monolith until:
1. Deployment is bottleneck (more than weekly)
2. Scaling needs diverge (different services need different scale)
3. Team > 30 engineers (coordination overhead)
4. Technology needs diverge (want different languages)

