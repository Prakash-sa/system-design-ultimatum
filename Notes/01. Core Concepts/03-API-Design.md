# API Design Tradeoffs

## REST vs gRPC vs GraphQL vs WebSockets vs SSE vs HTTP Long Polling vs WebHooks

| Aspect | REST | gRPC | GraphQL | WebSockets | SSE | HTTP Long Polling | WebHooks |
|--------|------|------|---------|-----------|-----|-------------------|----------|
| **Protocol** | HTTP/1.1 or HTTP/2; JSON | HTTP/2; Protocol Buffers | HTTP/1.1 or HTTP/2; JSON query | HTTP/2 with WS upgrade; binary framing | HTTP/1.1 chunked stream | HTTP/1.1 repeated requests | HTTP/1.1 POST callbacks |
| **Direction** | Request-response (client asks) | Request-response (client asks) | Request-response (client asks) | **Bi-directional** (client ↔ server) | **One-way push** (server → client) | **Polling** (client repeatedly asks) | **One-way push** (server → client) |
| **Payload Size** | Large (JSON verbose) | Small (binary protobuf) | Varies (only requested fields) | Small (binary framing) | Medium (text events) | Large (repeated requests + headers) | Medium (JSON) |
| **Latency** | Moderate (text parsing) | Low (binary, multiplexing) | Moderate (parsing, resolving) | **Very low** (~ms, bidirectional) | **Low** (~ms, server→client) | **High** (polling interval 1-30s) | N/A (async, eventual) |
| **Bandwidth** | High (verbose JSON) | Low (compact binary) | Medium (flexible selection) | Low (binary, efficient) | Medium (text, header overhead) | **Very High** (repeated requests, headers) | Medium |
| **Connection Model** | Stateless (request/response) | Stateless (request/response) | Stateless (request/response) | **Persistent, stateful** | **Persistent, stateful** | Stateless (repeated connections) | No connection (event-driven) |
| **Learning Curve** | Easy (HTTP verbs, JSON) | Moderate (protobuf, proto files) | Moderate-Hard (query language) | Moderate (WebSocket API, backpressure) | Easy (EventSource API) | **Very Easy** (just loop + sleep) | Easy (HTTP POST) |
| **Caching** | Easy (HTTP caching, ETags) | Difficult (POST-based, binary) | Difficult (queries vary) | Difficult (stateful) | Difficult (streaming) | Difficult (cache busting needed) | N/A (events) |
| **Browser Support** | Native | Requires gRPC-Web proxy | Native (via HTTP) | Native (most modern) | Native (most modern) | **Native** (oldest browsers) | N/A (server-side) |
| **Flexibility** | Fixed endpoints (over/under-fetch) | Fixed schema (efficient) | **Highly flexible** (client specifies) | Flexible (custom messages) | Fixed event types | Fixed endpoints | Event-based (no control) |
| **Streaming** | Not native (chunked transfer) | Bi-directional streaming | Subscriptions (separate WS/SSE) | **Full bi-directional** | **One-way server→client** | No streaming | N/A |
| **Scalability** | Good (stateless, scales horizontally) | Good (stateless, scales well) | Good (stateless, query-dependent) | Complex (stateful, sticky sessions) | Excellent (stateless, HTTP-friendly) | **Poor** (too many requests, server load) | Excellent (fire-and-forget) |
| **Error Handling** | HTTP status codes (200-5xx) | gRPC codes (granular) | Always 200; errors in body | Custom in message framing | No error feedback (one-way) | HTTP status codes | Implicit (no ack) |
| **Use When** | CRUD, public APIs, general web | Microservices, internal, high-throughput | Mobile clients, flexible schemas, multiple shapes | Chat, gaming, collaborative editing, real-time trading | Live dashboards, tickers, notifications, progress | Legacy browsers, fallback mechanism, simple updates | Webhooks, async events, integrations |
| **Drawbacks** | Verbose; hard to cache; over/under-fetch | Complex setup; not browser-native; proto versioning | N+1 queries; expensive queries; caching hard | Stateful; sticky sessions; connection mgmt; proxy issues | One-way only; message size limits; no request-response | **High latency & bandwidth; wasted requests; server overload** | No guaranteed delivery; unidirectional; ordering issues |
| **Examples** | Stripe, GitHub REST, AWS | Kubernetes, Google Cloud internal, Etsy | GitHub GraphQL, Shopify, Slack | Slack, Discord, Figma, Google Docs | Stock tickers, live scores, monitoring dashboards | Old Gmail, older Slack, polling fallback | GitHub, Stripe, Twilio webhooks |

**Quick Decision Guide:**
- **REST**: Default for public/web APIs, CRUD-heavy, browser support, simple operations
- **gRPC**: Internal service-to-service, need low latency/bandwidth, polyglot microservices
- **GraphQL**: Mobile clients, flexible queries, complex nested data, multiple client types
- **WebSockets**: Interactive, bidirectional real-time (chat, gaming, collab editing, trading)
- **SSE**: Server push only, simple one-way updates (dashboards, notifications, tickers)
- **HTTP Long Polling**: Legacy browser support, simple fallback, tolerate high latency/bandwidth
- **WebHooks**: Async event notifications, third-party integrations, fire-and-forget

---

## REST (Representational State Transfer)

**Pros:**
- Simple, intuitive HTTP verbs (GET, POST, PUT, DELETE)
- Excellent browser support and debugging tools
- Native HTTP caching with ETags, cache headers
- Stateless; highly scalable
- Mature ecosystem and widespread adoption
- Easy API versioning (v1, v2 in URL)

**Cons:**
- Verbose JSON payloads; high bandwidth usage
- Over-fetching (unnecessary fields returned)
- Under-fetching (need multiple requests)
- Hard to evolve without breaking clients
- No fine-grained field selection
- Not ideal for complex, nested data relationships

**When to Use:**
- Public APIs for third-party developers (Stripe, AWS, GitHub REST API)
- Simple CRUD operations on resources
- High cache-hit scenarios (product catalogs, static content)
- Team expertise in REST; no special infrastructure
- Browser-based clients or mobile clients that benefit from HTTP standards

**Example:**
<details>
<summary>Click to view code</summary>

```
GET /api/users/123  → { id, name, email, createdAt, posts: [...] }  # Over-fetch
GET /api/users/123/posts  → Returns all post fields  # Under-fetch

# With REST, you either get all fields or need multiple endpoints
```

</details>

---

## gRPC (Google Remote Procedure Call)

**Pros:**
- Binary Protocol Buffers: compact, fast serialization
- HTTP/2 multiplexing: multiple requests over one connection
- Bi-directional streaming (client→server, server→client)
- Strong typing via proto definitions
- Low latency and bandwidth (30% smaller than JSON)
- Service generation: auto-generate client/server stubs
- Built-in load balancing and service discovery

**Cons:**
- Not browser-native (requires gRPC-Web proxy)
- Steeper learning curve (Protocol Buffers, proto versioning)
- Binary payloads not human-readable; harder to debug
- HTTP/2 required (older infrastructure might struggle)
- Harder to cache than REST
- Overkill for simple, infrequent APIs
- Requires dedicated tooling and code generation

**When to Use:**
- Internal service-to-service communication (microservices)
- High-throughput, latency-sensitive systems (real-time, finance)
- Mobile apps needing bandwidth efficiency (2G/3G connections)
- Streaming requirements (file uploads, real-time updates)
- Organizations with polyglot microservices (language-agnostic)

**Example:**
<details>
<summary>Click to view code (protobuf)</summary>

```protobuf
// Proto definition
service UserService {
  rpc GetUser(UserId) returns (User);
  rpc StreamPosts(UserId) returns (stream Post);  // Server streams posts
  rpc UploadProfilePic(stream ImageChunk) returns (ProfileUrl);  // Client streams chunks
}

// Result: Type-safe, compact, multiplexed over HTTP/2
```

</details>

---

## GraphQL

**Pros:**
- Client specifies exactly what fields needed; no over/under-fetch
- Single endpoint; no API versioning headaches
- Strong typing via schema; excellent IDE support
- Nested queries in single request (relationships)
- Self-documenting via introspection; built-in schema exploration
- Great for mobile clients with bandwidth constraints
- Easier API evolution (new fields without breaking old clients)

**Cons:**
- Resolver complexity (N+1 query problem if not careful)
- Query cost hard to predict (expensive queries possible)
- Caching is non-trivial (GET via query string vs POST)
- Large query payloads possible (more parsing overhead)
- Learning curve (schema design, resolvers, federation)
- Overkill for simple CRUD APIs
- Requires monitoring query depth/complexity to prevent abuse
- Subscription support needs separate WebSocket infrastructure

**When to Use:**
- Mobile/web clients needing flexible field selection
- Multiple clients with different data shape requirements (web, mobile, TV)
- Complex, highly-related data (social graphs, e-commerce product hierarchies)
- API that evolves frequently without breaking clients
- Reduce bandwidth for mobile apps

**Example:**
<details>
<summary>Click to view code (graphql)</summary>

```graphql
# Client requests only needed fields
query {
  user(id: 123) {
    id
    name
    posts {
      id
      title
      comments {
        text
      }
    }
  }
}

# Fetches nested data in single request; only returns what's asked for
# No over-fetching unnecessary fields
```

</details>

---

## WebSockets vs Server-Sent Events (SSE)

| Aspect | WebSockets | SSE (Server-Sent Events) | When to Use |
|--------|-----------|------------------------|-------------|
| **Direction** | Bi-directional (client ↔ server) | One-way (server → client) | WebSockets: interactive; SSE: notifications |
| **Connection Type** | Full-duplex persistent TCP (HTTP upgrade) | One-way persistent HTTP | WebSockets: chat/gaming; SSE: streaming updates |
| **Latency** | Very low (~ms) | Low (~ms, but one-way) | Both excellent for real-time |
| **Protocol** | Custom binary framing after HTTP upgrade | Plain HTTP with chunked transfer | WebSockets for low-latency; SSE for simplicity |
| **Browser Support** | Native (modern browsers) | Native (most modern browsers) | Both have good support |
| **Fallback** | Requires custom polyfill (long-polling) | Auto-reconnect, built-in retry | SSE has better fallback semantics |
| **Bandwidth** | Low (binary framing, multiplexing) | Medium (text events, headers repeated) | WebSockets more efficient |
| **Scalability** | More connections; stateful session | Fewer resources; HTTP-friendly | SSE scales better with many clients |
| **Proxy/LB Compat** | Needs sticky sessions, WS-aware proxies | Works with standard HTTP load balancers | SSE better for cloud/CDN deployment |
| **Use When** | Chat, collaborative editing, multiplayer games, real-time trading | Live dashboards, notifications, live feeds, progress tracking | |
| **Drawbacks** | Stateful; complex backpressure; sticky sessions; old proxies drop connections | One-way only (client can't stream to server); message size limits on some servers; no native request-response | |
| **Examples** | Slack, Discord, Google Docs collab, Twitch chat | Stock price tickers, live sports scores, GitHub live feeds, Sentry error notifications | |

---

### WebSockets Deep Dive

**Pros:**
- True bi-directional communication (client ↔ server, simultaneously)
- Very low latency; minimal overhead after handshake
- Binary framing; efficient protocol
- Ideal for interactive, high-frequency updates (chat, gaming, collaborative editing)
- Single persistent connection; reduces connection overhead vs long-polling
- Built-in ping/pong keepalive

**Cons:**
- Stateful connections; harder to scale (sticky sessions, in-memory state)
- Requires WS-aware load balancers/proxies; older infrastructure may drop connections
- Complex backpressure handling; no built-in flow control
- Manual reconnect logic and state sync on disconnect
- Memory overhead per connection (not suitable for millions of idle connections)
- Harder to debug (binary protocol, custom framing)
- Requires separate port/endpoint configuration

**When to Use:**
- Real-time collaborative applications (Google Docs, Figma, Miro)
- Chat and messaging systems (Slack, Discord, WhatsApp Web)
- Multiplayer games (Fortnite, Valorant—not turn-based)
- Live trading/financial platforms (stock prices, forex)
- Real-time notifications requiring bidirectional interaction
- High-frequency, low-latency requirements

**Example:**
<details>
<summary>Click to view code (javascript)</summary>

```javascript
// Client
const ws = new WebSocket('wss://api.example.com/ws');
ws.onmessage = (event) => {
  console.log('Server says:', event.data);
};
ws.send(JSON.stringify({ action: 'move', x: 100, y: 200 })); // Client→Server

// Server sends back immediately
ws.onmessage = (event) => {
  // Other players' movements, game state, etc.
  const message = JSON.parse(event.data);
  updateGameState(message);
};
```

</details>

---

### Server-Sent Events (SSE) Deep Dive

**Pros:**
- Simpler than WebSockets; uses standard HTTP
- Built-in reconnect mechanism with exponential backoff
- Works with standard HTTP load balancers; no sticky sessions needed
- Lower memory overhead per connection (HTTP semantics)
- Works through CDNs and proxies seamlessly
- Text-based; easy to debug (plain HTTP stream)
- Event IDs and retry semantics built-in
- Perfect for unidirectional server→client streaming

**Cons:**
- One-way only; client cannot stream to server (need separate channel)
- Text-based payload; less efficient than binary WebSocket framing
- HTTP header overhead on each message (in some implementations)
- Limited message size on some servers
- Older browsers need polyfill
- Per-connection memory still grows with concurrent clients (but less than WS)
- Not ideal for request-response patterns

**When to Use:**
- Live dashboards and monitoring (real-time metrics, system status)
- Notifications (GitHub deployments, Stripe webhooks as server pushes)
- Live feeds (Twitter live tweets, news tickers)
- Progress tracking (video transcoding, long-running jobs)
- Server → browser notifications (system alerts, real-time updates)
- Scenarios where client rarely needs to send data

**Example:**
<details>
<summary>Click to view code (javascript)</summary>

```javascript
// Client
const eventSource = new EventSource('/api/live/scores');
eventSource.addEventListener('score-update', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Goal! ${data.team}: ${data.score}`);
});

eventSource.addEventListener('game-over', (e) => {
  console.log('Final score:', e.data);
  eventSource.close();
});

// Server (Node.js)
app.get('/api/live/scores', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial connection
  res.write('retry: 10000\n\n');
  
  // Stream events
  const interval = setInterval(() => {
    const score = getLatestScore();
    res.write(`id: ${score.id}\n`);
    res.write(`event: score-update\n`);
    res.write(`data: ${JSON.stringify(score)}\n\n`);
  }, 1000);
  
  req.on('close', () => clearInterval(interval));
});
```

</details>

---

### HTTP Long Polling Deep Dive

**Pros:**
- Simple to implement; no special infrastructure
- Works in old browsers (IE6+); no WebSocket support needed
- Natural fallback for WebSocket failures
- Stateless server; scales like REST
- Works through proxies and firewalls without special config
- Easy to debug (plain HTTP requests/responses)

**Cons:**
- High latency (polling interval creates delay: 1-30 seconds typical)
- Wasted bandwidth (repeated requests with headers even if no data)
- Server overhead (many open connections; each polls)
- Inefficient for high-frequency updates
- Race conditions (requests in flight when new data arrives)
- Terrible user experience for real-time needs

**When to Use:**
- Fallback for WebSocket-incompatible environments
- Legacy browser support (IE9, older Android)
- When other real-time techniques unavailable
- Low-frequency, non-critical updates (once per minute acceptable)
- Simple integration with existing REST APIs

**When NOT to Use:**
- Anything requiring < 1 second latency
- High-frequency updates (stock prices, gaming)
- Large concurrent user bases (bandwidth killer)
- Real-time collaboration
- Any modern application (just use WebSockets/SSE)

**Example:**
<details>
<summary>Click to view code (javascript)</summary>

```javascript
// Client: Poll every 5 seconds
function longPoll() {
  fetch('/api/messages')
    .then(res => res.json())
    .then(data => {
      // Process messages
      data.messages.forEach(msg => {
        console.log('New message:', msg);
        displayMessage(msg);
      });
      
      // Poll again after 5 seconds
      setTimeout(longPoll, 5000);
    })
    .catch(err => {
      console.error('Poll failed:', err);
      // Retry with exponential backoff
      setTimeout(longPoll, 5000);
    });
}

// Server: Return immediately with data, or wait for data
app.get('/api/messages', (req, res) => {
  const userId = req.query.user_id;
  const lastSeenId = req.query.last_id || 0;
  
  // Get unread messages
  let messages = db.getMessages(userId, lastSeenId);
  
  if (messages.length > 0) {
    // Data available; return immediately
    res.json({ messages });
  } else {
    // No data; wait up to 30 seconds for new messages
    const timeout = setTimeout(() => {
      res.json({ messages: [] });
    }, 30000);
    
    // Listen for new messages
    db.on(`user:${userId}:new-message`, (msg) => {
      clearTimeout(timeout);
      res.json({ messages: [msg] });
    });
  }
});
```

</details>

**Bandwidth comparison** (1000 users, 5-second polling):
<details>
<summary>Click to view code</summary>

```
Long Polling:
- 1000 users × 200 requests/hour = 200K requests/hour
- × 500 bytes/request (headers + small response) = 100MB/hour
- Server holds open connection per user = 1000 connections

WebSocket/SSE:
- 1000 users × 1 connection = 1000 connections
- Only sends when data available = 10MB/hour (events only)
- Result: 10x less bandwidth, 1000x fewer requests
```

</details>

---

### Real-Time API Pattern Comparison Summary

| Scenario | Best Choice | Why |
|----------|------------|-----|
| Chat application | WebSocket | Bidirectional, low latency, always connected |
| Live stock ticker | SSE | Server→client only, simpler, load balancer friendly |
| Collaborative document editing | WebSocket | Bidirectional edits, conflict resolution, low latency |
| Live sports scores | SSE | One-way push, no client input, high client count |
| Multiplayer game | WebSocket | Bidirectional, precise timing, state sync |
| System monitoring dashboard | SSE | Metrics pushed from server, no client control needed |
| Real-time notifications | SSE or WebSocket | SSE if no response; WebSocket if acknowledge/interact |
| Video call (WebRTC) | WebSocket (signaling) | WebSocket for SDP/ICE exchange; RTC for media |

---

## Interview Questions & Answers

### Q1: Design Slack. Which API patterns would you combine?

**Answer:**
**Layered approach:**
1. **REST** for static operations
   - User signup/login
   - Workspace/channel creation
   - Profile updates

2. **WebSockets** for real-time chat
   - Bidirectional message exchange
   - Typing indicators
   - Online status updates
   - Low-latency (sub-second) requirements

3. **Webhooks** for integrations
   - GitHub integration (code notifications)
   - Jira integration (ticket updates)
   - External event notifications

**Architecture**:
<details>
<summary>Click to view code</summary>

```
User → REST login → Get auth token
User → WebSocket connect → Join chat room
Chat message → WebSocket broadcast → All users in room

External system → Webhook POST → Slack notification
```

</details>

---

### Q2: Should you use REST, gRPC, or GraphQL for your microservices?

**Answer:**
**By use case:**

- **REST**: Public/external APIs, simple CRUD
- **gRPC**: Internal service-to-service, high throughput
- **GraphQL**: API Gateway, multiple client needs

**Recommendation**: **Hybrid approach**
<details>
<summary>Click to view code</summary>

```
Client (Web/Mobile) → REST Gateway → Converts to gRPC internally

Benefits:
- External clients use simple REST
- Internal services use efficient gRPC
- No protocol mismatch
- Best of both worlds
```

</details>

**Example**:
<details>
<summary>Click to view code</summary>

```
GET /api/users/123 (REST)
  ↓
  API Gateway converts to:
  ↓
GetUser(id=123) (gRPC to user-service)
  ↓
GetUserPosts(user_id=123) (gRPC to post-service)
  ↓
Combine responses → Return REST response
```

</details>

---

### Q3: You need to push 100K events/second to web browsers. REST, SSE, or WebSockets?

**Answer:**
**SSE is optimal** because:
- Server-to-client only (browsers don't send events back)
- Standard HTTP (works with CDN, load balancers)
- Scales to 100K connections easily (stateless)

**Avoid WebSockets** because:
- Stateful = sticky sessions
- 100K WebSocket connections need complex infrastructure

**Architecture**:
<details>
<summary>Click to view code</summary>

```
Event stream (Kafka) → Event broadcaster → SSE server (multiple instances)
                                         ↓
                                      Browser 1
                                      Browser 2
                                      ...
                                      Browser 100K

Each SSE connection:
- Gets own HTTP/2 stream
- No server state
- Load balancer can distribute freely
```

</details>

---

### Q4: GraphQL vs REST for mobile app. Which is better and why?

**Answer:**
**GraphQL wins** for mobile because:

1. **Bandwidth**: Request only needed fields
   ```graphql
   # Instead of:
   GET /users/123 → 50KB (name, bio, profile pic, friends count, etc.)
   
   # Mobile requests:
   query { user(id: 123) { name, profile_pic } } → 5KB
   ```

2. **Fewer requests**: Fetch related data in one query
   ```graphql
   query {
     user(id: 123) {
       posts { id, title },
       friends { name, avatar }
     }
   }  # One request, multiple data types
   <details>
<summary>Click to view code</summary>

```

3. **Network efficiency**: Critical on 4G/LTE

**Caveats:**
- Resolver complexity (N+1 problem)
- Need proper query depth limits

**Mitigation**:
```

</details>

Set limits:
- Max depth: 5 levels
- Max fields per query: 100
- Timeout: 30 seconds
- Query cost analysis (expensive queries rejected)
<details>
<summary>Click to view code</summary>

```

---

### Q5: How would you design real-time notifications for 10 million users?

**Answer:**
**Architecture**:

```

</details>

1. Notification source → Message queue (Kafka)
                      ↓
2. Event processor → Millions of notifications/sec
                   ↓
3. Delivery layer (choose by user preference):
   - Push notification (mobile) → Firebase Cloud Messaging
   - Email → Email service
   - In-app WebSocket → Real-time updates
   - SSE → Server-sent events
<details>
<summary>Click to view code</summary>

```

**For 10M users**:
- 10M users × 1% active = 100K concurrent connections
- SSE more scalable than WebSockets
- Use Redis Pub/Sub for fan-out

**Implementation**:
```

</details>

python
# Notification triggered
def send_notification(user_id, message):
    queue.push("notifications", {"user_id": user_id, "msg": message})

# Worker processes notifications
def process_notifications():
    while True:
        notification = queue.pop("notifications")
        user_id = notification['user_id']
        
        # Route by user preference
        if user_prefs[user_id].method == "websocket":
            broadcast_via_websocket(user_id, notification)
        elif user_prefs[user_id].method == "sse":
            broadcast_via_sse(user_id, notification)
        elif user_prefs[user_id].method == "push":
            send_push_notification(user_id, notification)

# Broadcast via Redis Pub/Sub
def broadcast_via_sse(user_id, notification):
    redis.publish(f"user:{user_id}:notifications", json.dumps(notification))
    # 1000 active browsers on that user's notification channel receive it
```

**Key points**:
- Message queue decouples producers from consumers
- Redis Pub/Sub for fan-out (10 subscribers share 1 publish)
- SSE scales better than WebSockets for this volume

