# Unique System Design Topics

These notes capture recurring deep-dive ideas that are useful across system design interviews. The focus is on the decision, the reason it works, and the tradeoffs worth calling out.

## Google Docs: Collaborative Editing

### Why Full Snapshots Fail

Sending the entire document on every edit is both inefficient and incorrect.

- **Inefficient:** a fast typist could send hundreds of KB per keystroke.
- **Incorrect under concurrency:** if User A turns `Hello!` into `Hello, world!` while User B deletes `!`, the last write wins and one user's edit is lost.

### Why Raw Edits Are Not Enough

Sending deltas is better than sending full snapshots, but each edit is based on the document state the client saw.

- User A sends `INSERT(5, ", world")`.
- User B sends `DELETE(6)` to remove `!`.
- If A's insert is applied first, B's `DELETE(6)` may delete the wrong character.

The missing concept is **context**. Every operation must be interpreted relative to other concurrent operations.

### Operational Transformation vs CRDTs

**Operational Transformation (OT)** transforms operations before applying them.

- A central server establishes the canonical operation order.
- If `INSERT(5, ", world")` arrives before `DELETE(6)`, the server can transform the delete into `DELETE(13)` so it still removes `!`.
- OT is a strong fit for Google Docs-style text collaboration because it is memory efficient and works well with a centralized service.

**Tradeoffs:**

- Requires a central ordering service.
- Hard to implement correctly.
- Scales well for small-to-medium collaboration groups, but not unlimited peers.

**Conflict-free Replicated Data Types (CRDTs)** make operations commutative so clients eventually converge even when edits arrive in different orders.

- Positions are represented with stable, uniquely ordered identifiers.
- Deletes are often tracked with tombstones.
- Works well for offline-first and peer-to-peer systems.

**Tradeoffs:**

- Higher memory usage.
- More metadata per edit.
- Conflict behavior can feel awkward when users edit the same region.

For a Google Docs interview, choose **OT** unless the interviewer pushes for offline-first or peer-to-peer collaboration.

### Document Operation Storage

Store operations append-only so edits are durable before acknowledgment.

- Use Cassandra or another high-write-throughput store.
- Partition by `documentId`.
- Order by server-assigned operation sequence or timestamp.
- Acknowledge the client only after the operation is persisted.

### Real-Time Read Path

When a user joins a document:

1. Open a WebSocket connection.
2. Load the latest snapshot plus operations after that snapshot.
3. Send the current document state to the client.
4. Keep the socket subscribed to future operations for the document.

When another collaborator edits:

1. Server receives the operation.
2. Server transforms it against concurrent operations.
3. Server persists the operation.
4. Server broadcasts it to connected clients.
5. Clients transform remote operations against local unacknowledged edits.

Clients still need OT logic because users expect local edits to appear immediately before the server confirms them.

### Presence and Cursor Position

Presence is ephemeral and should not live in the document data model.

- Store active users and cursors in memory on the Document Service.
- Broadcast cursor changes over the same WebSocket connection.
- On connect, send the current presence set.
- On disconnect, remove the user and broadcast the update.

### Scaling WebSockets

A single Document Service cannot handle millions of connections.

Use consistent hashing by `documentId`:

- Each Document Service owns a range of document hashes.
- A client may connect to any server first.
- That server redirects the client to the owner for the requested document.
- All active editors for the same document land on the same server.
- ZooKeeper or etcd maintains the hash ring.

**Tradeoffs:**

- Rebalancing moves connection state.
- Server failures force clients to reconnect.
- During ring transitions, the system may need to understand both old and new ownership.

### Storage Compaction

Documents with millions of operations become expensive to load and replay.

Use periodic snapshotting:

- Compact operations when a document becomes idle.
- Write a new snapshot or compacted operation set under a new `documentVersionId`.
- Update document metadata to point at the new version.
- Keep older versions only if version history is required.

## Facebook News Feed: High Follow Counts

### Problem

Users who follow many accounts make fan-out-on-read expensive:

- Query follows.
- Query posts for every followed account.
- Merge and rank the result.

This can create thousands of backend requests for a single feed load.

### Better Approach: Fan-Out on Write

Precompute feeds when posts are created.

- Maintain a `PrecomputedFeed` table keyed by `userId`.
- Store recent post IDs in reverse chronological order.
- Limit each feed entry to a compact number of posts, such as 200.
- On post creation, append the post ID to follower feeds.

### Tradeoffs

- Faster reads, slower writes.
- Celebrity accounts can create huge write fanout.
- Product limits help: cap follows, delay updates for extreme accounts, or use a hybrid model where celebrity posts are merged at read time.

## LeetCode: Real-Time Leaderboard

### Problem

Fetching the leaderboard from the primary database is too slow if every request scans or sorts submission data.

### Better Approach: Redis Sorted Sets

Use Redis sorted sets for live ranking and the database for durable submissions.

- Key: `competition:leaderboard:{competitionId}`
- Score: total score, solve time, or ranking value.
- Member: `userId`
- Update on submission processing:

```redis
ZADD competition:leaderboard:{competitionId} {score} {userId}
```

- Read top users:

```redis
ZRANGE competition:leaderboard:{competitionId} 0 99 REV WITHSCORES
```

### Tradeoffs

- Polling every 5 seconds is simpler than WebSockets and is usually enough.
- Redis handles top-N reads efficiently.
- The source of truth remains the main database, so Redis can be rebuilt.

## WhatsApp: Routing Across Chat Servers

### Problem

With hundreds of chat servers, sender and recipient may be connected to different hosts. The system needs to route messages to the server that owns the recipient's socket.

### Better Approach: Redis Pub/Sub for Live Delivery

On connection:

1. Chat Server subscribes to the user's channel.
2. Messages published to that channel are forwarded to the user's WebSocket.

On send:

1. Write message and inbox entries durably.
2. Return success to the sender.
3. Publish to the recipient's Pub/Sub channel for best-effort live delivery.

### Why This Works

Redis Pub/Sub is lightweight because it does not persist messages or maintain consumer offsets. Channels are in-memory routing pointers, which makes them much cheaper than Kafka topics for per-user live delivery.

### Tradeoffs

- Pub/Sub is at-most-once.
- Real-time delivery can fail if there is no subscriber or Redis has a transient issue.
- This is acceptable because inbox/message tables are written before publishing; missed messages are recovered on reconnect or polling.
- Redis should be sharded by user ID at large scale.

## YouTube: Video Streaming and Processing

### Core Terms

- **Codec:** compresses and decompresses video, such as H.264, H.265, VP9, or AV1.
- **Container:** file format that stores video, audio, and metadata.
- **Bitrate:** amount of data transmitted per second.
- **Manifest file:** index that lists available video variants and segment URLs.

### Watching Videos: Adaptive Bitrate Streaming

Store each video as segments across multiple qualities and formats.

Client flow:

1. Fetch `VideoMetadata`.
2. Download the manifest URL from object storage or CDN.
3. Choose an initial format based on device, settings, and network.
4. Download and play segments.
5. Switch quality dynamically as bandwidth changes.

### Processing Pipeline

When the original video upload completes:

1. Split the video into short segments.
2. Transcode segments into multiple codec/container/quality combinations.
3. Process audio and transcripts if needed.
4. Generate primary and media manifest files.
5. Mark the upload complete.

This pipeline is naturally a DAG:

- Segment-level work is parallelizable.
- Transcoding is CPU-heavy.
- Temporal, Step Functions, or another orchestrator can manage dependencies.
- Temporary files can be passed through S3/object storage URLs.

### Resumable Uploads

Use multipart upload:

- Client splits the original file into 5-10 MB chunks.
- Each chunk has a fingerprint/hash.
- `VideoMetadata` tracks chunk status.
- Client uploads chunks to S3.
- Backend verifies ETags/fingerprints and marks chunks uploaded.
- `CompleteMultipartUpload` triggers downstream processing once per object.
- Interrupted clients resume by checking uploaded chunks and skipping completed work.

### Scaling Reads and Writes

- Video Service is stateless and horizontally scalable.
- Metadata can use Cassandra partitioned by `videoId`.
- Hot video metadata should be cached.
- Video segments and manifests should be served through a CDN.
- Processing workers scale based on queue depth.

### Additional Deep Dives

- Pipeline uploads by letting clients upload pre-split segments.
- Resume playback by storing user/video watch position.
- Maintain view counts with exact or approximate counters.

## Facebook Live Comments

### Historical Comments

When a viewer joins a live stream, they need:

- New comments in real time.
- Recent historical comments for context.
- Infinite scroll for older comments.

Use cursor pagination instead of offset pagination.

Example:

```http
GET /comments/:liveVideoId?cursor={last_comment_id}&pageSize=10
```

For DynamoDB:

```json
{
  "TableName": "comments",
  "KeyConditionExpression": "liveVideoId = :liveVideoId AND commentId < :cursor",
  "ExpressionAttributeValues": {
    ":liveVideoId": "liveVideoId",
    ":cursor": "last_comment_id"
  },
  "ScanIndexForward": false,
  "Limit": "pageSize"
}
```

### Real-Time Delivery

Server-Sent Events (SSE) are a good fit because comments are server-to-client updates.

Flow:

1. User posts a comment.
2. Comment Management Service persists it.
3. Realtime Messaging Service sends it over SSE to subscribed viewers.

### Scaling Across Servers

When viewers of the same live video are connected to different servers, the system needs coordination.

Good options:

- **Pub/Sub:** servers subscribe to live-video channels and receive comments to fan out locally.
- **Dispatcher Service:** maintains a map of `liveVideoId -> realtime servers` and routes comments directly.

Pub/Sub is usually simpler in interviews. A dispatcher centralizes routing but requires accurate membership tracking through heartbeats and shared coordination data.

### Mega-Streams

For a massive stream, delivering every comment to every viewer becomes pointless and expensive.

Switch to CDN-backed snapshots:

- Maintain a ring buffer of recent comments.
- Write a snapshot every second to Redis or CDN origin.
- Clients poll the CDN.
- Clients animate comments smoothly to simulate a live stream.

**Tradeoffs:**

- Adds 1-2 seconds of latency.
- Optimistic local insertion preserves "read your own write."
- Use hysteresis when switching between SSE and CDN mode to avoid flapping.

### Disconnections

Use `Last-Event-ID` for SSE reconnects.

- Every comment event has an ID.
- On reconnect, browser sends the last received ID.
- Server replays missed comments before resuming live delivery.
- Client can also request catch-up:

```http
GET /comments/:liveVideoId?since={last_comment_id}&limit=100
```

Deduplicate by comment ID when HTTP catch-up and SSE overlap.

## Uber: Ride Matching

### Driver Location Updates

The naive design fails because:

- 10 million drivers updating every 5 seconds means about 2 million writes per second.
- Lat/long proximity queries are inefficient with normal B-tree indexes.

Use Redis geospatial data:

- `GEOADD` updates the latest driver location.
- `GEOSEARCH` finds nearby drivers.
- Each update overwrites the driver's previous location.
- Track last update time in a companion sorted set.
- Periodically remove stale drivers from both the timestamp set and geo set.

**Tradeoffs:**

- Redis location state is ephemeral.
- Persistence and Sentinel/cluster failover reduce risk.
- If state is lost, drivers repopulate it within the next update interval.

### Adaptive Location Frequency

Reduce load from client updates:

- Stationary drivers send updates less often.
- Fast-moving or direction-changing drivers send updates more often.
- Proximity to active demand can increase update frequency.
- Client-side sensors should help determine the right interval.

### Preventing Duplicate Ride Offers

Use Redis locks with TTL.

- Lock key: `driver:{driverId}:offer`
- TTL: offer response window, such as 10 seconds.
- Only the service that acquires the lock can send the driver a ride request.
- Release the lock on accept/decline.
- Let the lock expire on timeout.

### Avoiding Dropped Ride Requests

Use a durable queue before matching.

- Enqueue ride requests.
- Ride Matching Service consumes and commits only after it reaches a terminal state or durable workflow checkpoint.
- Partition queues by geographic region.
- Scale consumers based on queue depth.

### Driver Timeout Workflow

Ride matching is a multi-step, human-in-the-loop process. Durable execution tools such as Temporal or Step Functions are a strong fit.

Workflow:

1. Send offer to the best driver.
2. Wait 10 seconds.
3. Complete if accepted.
4. Move to the next driver if declined or timed out.
5. Continue until matched or exhausted.

### Geographic Scaling

Shard by region to reduce latency and improve throughput.

- Services, queues, databases, and Redis geo stores can all be region-scoped.
- Boundary cases may require querying adjacent shards.
- Consistent hashing and replication help with rebalancing and availability.

## Ad Click Aggregator

### Click Redirect Path

The Ad Placement Service decides which ad to show and includes the redirect URL and metadata. When a user clicks:

1. Browser calls `/click`.
2. Click Processor records the click event.
3. User is redirected to the advertiser's target URL.

For user experience, the redirect path should stay low-latency and avoid synchronous heavy analytics work.

### Real-Time Metrics

Use streaming aggregation:

1. Click Processor writes raw events to Kafka or Kinesis.
2. Flink or Spark Streaming consumes events.
3. Stream processor aggregates by event time into 1-minute windows.
4. Aggregates are written to an OLAP store.
5. Advertisers query near-real-time metrics.

Flink is useful because it provides event-time windows, watermarks, state recovery, and exactly-once-style processing semantics that are hard to rebuild correctly with plain consumers.

### Scaling 10k Clicks Per Second

- Click Processor scales horizontally behind a load balancer.
- Stream partitions by `adId`.
- Flink scales by partition/task.
- OLAP storage is partitioned for advertiser queries.

Handle hot ads by salting popular partition keys:

- Write with `adId:{salt}` for hot ads.
- Aggregate back to the original `adId` before or during OLAP writes.

### Preventing Data Loss

- Kafka/Kinesis stores events durably with retention, such as 7 days.
- Stream processors can replay from offsets.
- Flink checkpointing is helpful for larger windows.
- Raw events should also be archived to a data lake.
- Periodic batch reconciliation recomputes aggregates and corrects OLAP data.

This is a Lambda-style architecture: a speed layer for freshness and a batch layer for correctness.

### Click Abuse and Idempotency

Use impression IDs.

1. Ad Placement Service generates a unique impression ID per rendered ad instance.
2. It signs `{impressionId, adId}` with HMAC.
3. Browser sends the signed impression ID on click.
4. Click Processor verifies the signature.
5. Click Processor checks a Redis dedup cache.
6. If unseen, write the click to the stream and then record the impression ID in the cache.

Writing to the stream before updating the dedup cache favors recoverable duplicates over unrecoverable lost clicks.

### Low-Latency Advertiser Queries

- Store pre-aggregated minute-level metrics.
- Add daily or weekly rollup tables for long-range queries.
- Treat pre-aggregation like caching: more storage, faster reads.

## Metrics Monitoring Platform

### Metric Ingestion

At 5 million metrics per second, services should not POST every metric directly to central ingestion.

Use local agents or collectors:

- Collect metrics locally.
- Buffer and batch metrics.
- Optionally aggregate locally.
- Flush batches through Kafka.

Kafka buffers spikes and allows consumers to catch up after failures.

**Tradeoff:** if the system is down for 5 minutes, it must either catch up later or intentionally drop stale data. Monitoring systems often prefer bounded data loss over being permanently behind.

### Time-Series Storage

Use a database designed for metrics, such as InfluxDB, TimescaleDB, VictoriaMetrics, or another time-series store.

Why it fits:

- Append-only writes.
- Time-based partitioning.
- Strong compression for timestamps and values.
- Built-in rollups.
- Retention policies.

Example retention:

- Raw 10-second data for 15 days.
- 1-minute rollups for 90 days.
- 1-hour rollups for 1 year.

### Query Service

Put a query service in front of storage.

- Accept PromQL-like queries.
- Translate to storage-specific queries.
- Add result caching.
- Keep read scaling independent from write ingestion.

### Alert Rules

For alerts that can fire within about 1 minute, polling is enough.

1. Users define alert rules through an API.
2. Rules are stored in Postgres or a config store.
3. Alert Evaluator periodically queries the time-series database.
4. Violations emit alert events.

This is similar to Prometheus alert evaluation: alerts are scheduled queries.

### Notifications

Do not call Slack, PagerDuty, or email providers directly from the evaluator.

Use a Notification Service for:

- Deduplication.
- Grouping.
- Silencing.
- Escalation.
- Retry and failover.

Notify on alert state transitions, not every evaluation tick.

### Low-Latency Dashboard Queries

Long-range dashboard queries can scan huge amounts of data.

Use:

- **Query splitting:** recent ranges hit storage; historical ranges hit cache.
- **Precomputation:** popular dashboards are computed on a schedule.
- **Result caching:** cache by query and time range.
- **Rollups:** use lower-resolution data for longer ranges.

### Sub-Minute Alerting

If polling is too slow, evaluate critical alerts from the live stream.

- Flink consumes the metrics Kafka topic.
- It maintains rolling windows per series.
- Alert rules compile into stream operators.
- Violations emit alert events within seconds.

Keep polling for non-critical or coarse-grained alerts. Stream alerting adds operational complexity and should be justified by requirements.

### High Availability

Design ingestion and alerting as resumable paths.

Ingestion:

- Agents buffer locally.
- Kafka is replicated across zones.
- Writes are idempotent.

Alerting and notifications:

- Evaluation state is checkpointed.
- Alert events are written to Kafka before external delivery.
- Notification delivery retries and can fail over to secondary channels.

During failures, degrade freshness before correctness.

### Cardinality Explosion

Every unique metric name plus label set creates a time series. High-cardinality labels can create millions of series and overwhelm storage.

Controls:

- Policy store defines allowed labels and series caps per metric.
- Ingestion strips disallowed label keys.
- Redis tracks known series IDs and per-metric counts.
- New series over the cap are dropped and counted.
- Hitting a cap triggers an alert.

At very high ingestion rates, reduce Redis pressure with batching or a local Bloom filter as a first pass.

## Payment System: Security, Durability, and Scale

### Merchant Authentication

Payment APIs need to prove that a request came from the merchant, was not modified, and cannot be replayed.

Use API keys plus request signing:

- Public API key identifies the merchant.
- Private secret key stays on the merchant's server.
- Merchant signs the method, path, body, timestamp, and nonce with HMAC-SHA256.
- API Gateway recomputes the signature and rejects mismatches.
- Timestamp window prevents old requests from being replayed.
- Nonce cache prevents replay within the valid time window.

Example signed request:

```json
{
  "method": "POST",
  "path": "/payment-intents/{paymentIntentId}/transactions",
  "headers": {
    "Authorization": "Bearer pk_live_51NzQRtGswQnXYZ8o",
    "X-Request-Timestamp": "2023-10-15T14:22:31Z",
    "X-Request-Nonce": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "X-Signature": "sha256=7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
  }
}
```

### Card Data Protection

Minimize merchant exposure to sensitive card data.

Use a hosted iframe or payment element:

- Card details are entered inside payment-provider-controlled UI.
- JavaScript SDK encrypts card data in the browser using the provider's public key.
- Encrypted payload travels over HTTPS.
- Private keys live in Hardware Security Modules (HSMs).
- Merchant servers receive tokens, not raw card numbers.

This reduces PCI scope for merchants and limits blast radius if the merchant site is compromised.

### Durable Audit Trail

Payment systems need a complete immutable record of every payment attempt, state transition, refund, failure, and dispute-relevant event.

Separate operational state from audit history:

- **Operational database:** optimized for current merchant-facing state.
- **Change Data Capture (CDC):** reads committed database changes from the WAL/oplog.
- **Kafka event stream:** stores append-only payment events keyed by `payment_intent_id`.
- **Object storage archive:** keeps long-term immutable audit records.
- **Specialized consumers:** build audit, analytics, reconciliation, and webhook views.

Example CDC event:

```json
{
  "op": "update",
  "source": "payment_intents_db",
  "table": "payment_intents",
  "ts_ms": 1681234568901,
  "before": {
    "payment_intent_id": "pi_123",
    "status": "created"
  },
  "after": {
    "payment_intent_id": "pi_123",
    "status": "authorized"
  }
}
```

### CDC Tradeoffs

CDC is powerful because it captures database commits without relying on every application path to remember audit writes.

Risks and mitigations:

- CDC lag can hide downstream failures, so alert on lag within seconds.
- Run redundant CDC workers where appropriate.
- Retain database logs long enough to replay missed events.
- Archive Kafka events to object storage for permanent compliance retention.
- For the most critical flows, consider application-level fallback events if CDC confirmation is delayed.

### Transaction Safety with Payment Networks

External payment networks are asynchronous and outside our control. A timeout does not prove failure, and a missing response does not prove success.

Track intent before calling the network:

1. Write a payment attempt record with network, reference ID, amount, and intended action.
2. Call the payment network with an idempotency key/reference ID.
3. On success, mark the attempt `succeeded`.
4. On explicit failure, mark it `failed` with the reason.
5. On timeout, mark it `timeout` and send it to reconciliation.

This prevents guessing from network behavior and creates a durable trail for every external action.

### Reconciliation

Use a dedicated Reconciliation Service to resolve uncertainty.

- Consume timeout and attempt events from Kafka.
- Query payment network APIs by reference ID for near-real-time checks.
- Process network settlement/reconciliation files when they arrive.
- Compare external authoritative records against internal attempts.
- Update payment status based on confirmed external state.

The core rule: never retry a charge blindly after a timeout. Reconcile first or retry with the same idempotency key/reference.

### Two-Phase Event Model

For extra safety, transaction processing can emit lifecycle events around the database write:

- **Transaction Created:** emitted before processing begins.
- **Transaction Completed:** emitted after the database write commits.

If the completed event is missing, the system can inspect database state and either re-emit the completion event or safely retry the transaction path. This helps downstream consumers reason about partially completed work.

### Scaling to 10k+ TPS

Services:

- Keep API, PaymentIntent, Transaction, Reconciliation, and Webhook services stateless.
- Scale horizontally behind load balancers.

Kafka:

- Partition by `payment_intent_id` to preserve ordering per payment.
- Use multiple partitions to exceed single-partition throughput.
- Use replication factor 3 across brokers/zones.
- Scale consumers with consumer groups.

Database:

- 10k TPS means roughly 10k writes per second to operational storage.
- A single optimized Postgres instance may be near its limit.
- Shard by `merchant_id` or another stable tenant key.
- Use read replicas for status queries and reporting.
- Cache recent payment status when consistency requirements allow.

Storage growth:

- At 10,000 writes/sec and 500 bytes/write, raw growth is about 5 MB/sec.
- That is roughly 432 GB/day and 158 TB/year before indexes and replication.
- Move older operational records to object storage after the hot retention window.

### Webhooks

Webhooks are server-to-server notifications, not browser real-time updates.

Merchant configuration:

- Callback URL.
- Subscribed event types.
- Shared secret for webhook signature verification.

Delivery flow:

1. Payment state changes in the operational database.
2. CDC publishes the change to Kafka.
3. Webhook Service consumes the event.
4. Service checks merchant subscription rules.
5. Service builds and signs the webhook payload.
6. Service POSTs to the merchant endpoint.
7. Merchant verifies the signature and returns `2xx`.
8. Failed deliveries retry with exponential backoff.

Example payload:

```json
{
  "id": "evt_1JklMnOpQrStUv",
  "type": "payment.succeeded",
  "created": 1633031234,
  "data": {
    "object": {
      "id": "pay_1AbCdEfGhIjKlM",
      "amountInCents": 2499,
      "currency": "usd",
      "status": "succeeded",
      "created": 1633031200
    }
  }
}
```

Production webhook systems also need idempotency keys, delivery logs, merchant replay tooling, payload versioning, queue backlog handling, and adaptive rate limits so merchant endpoints are not overwhelmed.

## Google News: Aggregation, Feeds, and Scale

Google News is a read-heavy aggregation system. The hard parts are discovering fresh publisher content, serving low-latency feeds to many users, and keeping pagination stable while new articles arrive.

### Core Requirements

Functional:

- Aggregate articles from many publishers across regions and categories.
- Let users scroll through a feed continuously.
- Redirect users to the publisher site for the full article.

Non-functional:

- Feed requests should stay under roughly 200 ms.
- Fresh articles should appear within minutes, or within 30 minutes at worst.
- The system should tolerate breaking-news traffic spikes.
- Publisher failures should not break the feed experience.

### High-Level Architecture

Separate ingestion from serving because they scale differently.

Ingestion path:

1. Publisher webhooks, RSS feeds, APIs, or crawlers discover articles.
2. Ingestion workers normalize article metadata.
3. Media workers download and resize thumbnails.
4. Article metadata is stored in the primary database.
5. CDC publishes committed article changes to Kafka.
6. Feed generation workers update regional, category, and trending caches.

Serving path:

1. Client calls `GET /feed?region=US&limit=20&cursor=...`.
2. API Gateway handles auth, rate limits, and routing.
3. Feed Service reads a precomputed feed from Redis.
4. Feed Service returns article cards with publisher URLs and thumbnail URLs.
5. Clicking an article hits a tracking endpoint, then returns a `302` redirect to the publisher.

The feed service should not query the primary database on every request at large scale. The database is the source of truth, but Redis or another low-latency cache is the read path.

### Article Ingestion

RSS is a common baseline because many publishers already expose it. It is an XML document fetched over HTTP with title, URL, publish time, and metadata.

RSS polling flow:

1. Scheduler loads publisher feed URLs and polling frequency.
2. Fetcher downloads RSS or API responses.
3. Parser extracts article URL, title, author, region, category, publish time, and image URL.
4. Deduplication checks canonical URL and content hash.
5. Workers store normalized article rows and enqueue media processing.

Polling every 3-6 hours is easy, but too slow for breaking news. Use it as a fallback, not the only freshness mechanism.

### Publisher Webhooks

For high-value publishers, support push-based ingestion.

- Publisher calls `POST /webhooks/article-published`.
- Request is authenticated with API keys, HMAC signatures, or shared secrets.
- Payload includes canonical URL, title, publish time, category, region, and optional full metadata.
- Webhook handler validates the payload and writes it to Kafka.
- Ingestion workers process it through the same normalization and deduplication path.

Webhooks can get articles into the system within seconds. RSS and crawler fallback cover publishers that do not integrate.

Tradeoffs:

- Webhooks require publisher cooperation.
- Bad publisher payloads need quarantine and replay tooling.
- The endpoint must handle traffic bursts when many publishers report the same major story.

### Thumbnail Storage

Do not hotlink publisher images directly.

Reasons:

- Publisher image hosts may be slow or unavailable.
- URLs can change or expire.
- Images may be too large, inconsistent, or not optimized for feed cards.

Better path:

- Download the primary image during ingestion.
- Generate fixed sizes such as `150x100`, `300x200`, and `600x400`.
- Store variants in object storage.
- Serve them through a CDN.
- Use `srcset` or device-aware selection on the client.

This increases storage slightly, but CDN caching reduces origin traffic and keeps global thumbnail latency low.

### Cursor-Based Pagination

Offset pagination is fragile for feeds where new articles constantly arrive. If page 1 changes while a user is reading page 2, offset-based requests can duplicate or skip articles.

Use cursor pagination with monotonic article IDs.

Example:

```sql
SELECT *
FROM articles
WHERE region = 'US'
  AND article_id < :cursor_id
ORDER BY article_id DESC
LIMIT 20;
```

Good cursor choices:

- ULID.
- Snowflake-style ID.
- Database sequence if all inserts go through one ordered source.

Benefits:

- Stable pagination while newer articles arrive.
- Simple index access.
- No ambiguity from timestamp collisions.

Tradeoffs:

- The ID strategy must be chosen early.
- Distributed ID generation must preserve enough ordering for feed pagination.
- If ranking is not purely chronological, the cursor may need to include `(score, article_id)`.

### Low-Latency Feed Reads

At 100M daily active users, direct database reads for every feed request will not meet the latency or cost target.

Precompute hot feeds in Redis sorted sets:

- `feed:region:US`
- `feed:category:sports:US`
- `feed:category:tech:US`
- `feed:trending:US`

CDC update flow:

1. Article is committed to the database.
2. CDC emits an article-created event.
3. Kafka preserves event durability.
4. Feed workers score the article for region, category, and trending feeds.
5. Workers call `ZADD` with a timestamp or ranking score.
6. Workers trim old entries with `ZREMRANGEBYRANK`.

Keep only the most recent N items per feed, often 1,000-2,000 articles. This bounds cache memory while still supporting many scroll pages.

Feed read:

```text
ZREVRANGE feed:region:US 0 19 WITHSCORES
```

If article cards need more fields, either store compact JSON in the sorted set value or fetch article metadata from a secondary cache by article ID.

### Category Feeds

A simple version stores category metadata inside each regional cached article and filters in memory.

Example cached item:

```json
{
  "id": "01J2NEWSABC123",
  "title": "Market rally continues after jobs report",
  "url": "https://publisher.example/articles/market-rally",
  "category": "business",
  "region": "US",
  "published_at": "2026-07-14T12:30:00Z"
}
```

For moderate category traffic:

1. Read the latest 1,000 regional articles.
2. Filter by `category`.
3. Return the requested page.

This avoids duplicating articles across many caches.

For very hot categories:

- Maintain separate category sorted sets.
- Populate them from the same CDC pipeline.
- Scale reads independently for categories like sports, politics, or tech.

### Personalized Feeds

Do not create a dedicated cached feed for every user unless the product requires it. At 100M users, per-user feed caches become expensive and hard to refresh.

Use lightweight preference vectors and assemble feeds on demand from precomputed pools.

Example:

- 60% `feed:category:tech:US`
- 25% `feed:category:business:US`
- 15% `feed:trending:US`

The Feed Service reads from a few cached sorted sets, merges candidates, applies a ranking function, deduplicates, and returns the top items.

Ranking signals:

- User category preferences.
- Publisher affinity.
- Freshness.
- Regional relevance.
- Global importance.
- Diversity constraints.

Tradeoffs:

- Less personalized than a full recommendation system.
- Much cheaper than per-user cache materialization.
- Easier to degrade during traffic spikes by falling back to regional or trending feeds.

### Breaking-News Traffic Spikes

News traffic is regional. A major US story may spike US reads without affecting every region equally.

Scale by region:

- Deploy Feed Service instances close to users.
- Keep regional Redis clusters near those services.
- Use CDN caching for images and static client assets.
- Route users to the nearest healthy region.

Application layer:

- Keep Feed Service stateless.
- Horizontally scale behind load balancers.
- Autoscale on request rate, CPU, and p95 latency.

Cache layer:

- Use Redis read replicas for hot regional feeds.
- Send writes to the master and reads to replicas.
- Add replicas temporarily during breaking-news events.
- Monitor replication lag, cache hit rate, and slow commands.

Database layer:

- Keep feed reads off the database.
- Use the database for durable article state, publisher metadata, and backfills.
- Use read replicas for admin tools and less latency-sensitive queries.

If one Redis instance handles roughly 100k requests per second and a region needs 1M feed reads per second during a spike, use about 10 read replicas before adding safety margin.

### Freshness and Correctness

Freshness is measured from publisher publish time to user-visible feed time.

Track:

- Publisher delay: `publisher_publish_time` to ingestion receipt.
- Processing delay: ingestion receipt to article commit.
- CDC delay: commit to Kafka event.
- Feed delay: Kafka event to Redis update.
- Serving delay: Redis update to user-visible response.

Correctness controls:

- Deduplicate by canonical URL and content hash.
- Keep rejected or malformed articles in a quarantine queue.
- Support replay from Kafka or database backfill to rebuild caches.
- Add cache versioning so corrupted feed entries can be replaced safely.
- Use publisher reputation and spam checks before promoting articles to hot feeds.

### Interview Callouts

Strong defaults:

- Use webhooks for premium freshness and RSS/crawling as fallback.
- Use monotonic IDs or `(score, article_id)` cursors instead of offset pagination.
- Use CDC plus Kafka to update Redis feed caches.
- Keep hot feed reads out of the primary database.
- Store thumbnails in object storage and serve them through a CDN.
- Personalize by mixing precomputed feeds before considering per-user materialized feeds.
