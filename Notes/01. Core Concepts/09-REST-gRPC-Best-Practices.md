# REST API & gRPC Best Practices

## REST API Design Best Practices

### 1. Resource-Oriented Design

**Core Principle**: Design APIs around resources, not actions

**Good** (Resource-oriented):

```
GET    /api/users                    # List users
POST   /api/users                    # Create user
GET    /api/users/123                # Get user 123
PUT    /api/users/123                # Update user 123
DELETE /api/users/123                # Delete user 123
GET    /api/users/123/posts          # Get user's posts
```

**Bad** (Action-oriented):

```
GET    /api/getUsers
POST   /api/createUser
GET    /api/getUserById?id=123
POST   /api/updateUser
POST   /api/deleteUser
GET    /api/getUserPosts?id=123
```


**Why Resource-Oriented:**
- Standard HTTP methods map to CRUD
- Predictable patterns (developers learn once, apply everywhere)
- Caching works naturally (GET is cacheable)
- Easier versioning and evolution

---

### 2. HTTP Methods Semantics

| Method | Purpose | Idempotent | Safe | Use Case |
|--------|---------|-----------|------|----------|
| **GET** | Retrieve resource | Yes | Yes | Read data, no side effects |
| **POST** | Create new resource | No | No | Create entity, non-idempotent |
| **PUT** | Replace entire resource | Yes | No | Full update (all fields) |
| **PATCH** | Partial resource update | No | No | Partial update (some fields) |
| **DELETE** | Remove resource | Yes | No | Delete entity |
| **HEAD** | Like GET but no body | Yes | Yes | Check if resource exists |
| **OPTIONS** | Describe communication options | Yes | Yes | CORS preflight, API introspection |

**Idempotent**: Calling multiple times = same result as once
- `PUT /users/123` (replace) is idempotent; safe to retry
- `POST /users` (create) is NOT idempotent; each call creates new user

**Safe**: No side effects or state change
- `GET /users` is safe
- `POST /users` is not safe

**Examples**:
<details>
<summary>Click to view code</summary>

```
# CORRECT: PUT for full replacement
PUT /api/users/123
{
  "name": "John",
  "email": "john@example.com",
  "phone": "555-1234"
  // All fields required; replaces entire user
}

# CORRECT: PATCH for partial update
PATCH /api/users/123
{
  "email": "newemail@example.com"
  // Only email field; others unchanged
}

# WRONG:
PUT /api/users/123/updateEmail
// Don't use action verbs with PUT
```

</details>

---

### HTTP Status Codes

**2xx Success Codes:**

| Code | Name | When to Use |
|------|------|-------------|
| **200** | OK | Request succeeded, return data in body |
| **201** | Created | Resource successfully created |
| **202** | Accepted | Request accepted for async processing |
| **204** | No Content | Request succeeded, no response body (DELETE, empty updates) |
| **206** | Partial Content | Returning partial data (pagination, range requests) |

**3xx Redirection Codes:**

| Code | Name | When to Use |
|------|------|-------------|
| **301** | Moved Permanently | Resource moved to new URL (permanent redirect) |
| **302** | Found | Temporary redirect |
| **304** | Not Modified | Conditional GET returned no new data (ETag match) |
| **307** | Temporary Redirect | Like 302 but preserves HTTP method |
| **308** | Permanent Redirect | Like 301 but preserves HTTP method |

**4xx Client Error Codes:**

| Code | Name | When to Use | Example |
|------|------|-------------|---------|
| **400** | Bad Request | Request syntax invalid, missing required fields | `{ "errors": "email is required" }` |
| **401** | Unauthorized | Authentication required or failed | `{ "error": "Invalid API key" }` |
| **403** | Forbidden | Authenticated but not authorized for resource | `{ "error": "You don't have permission to edit this post" }` |
| **404** | Not Found | Resource doesn't exist | `{ "error": "User 999 not found" }` |
| **405** | Method Not Allowed | HTTP method not supported for endpoint | `GET /api/users (POST only)` |
| **409** | Conflict | Request conflicts with current state (duplicate, version mismatch) | `{ "error": "Email already registered" }` |
| **410** | Gone | Resource permanently deleted | Old API endpoint |
| **422** | Unprocessable Entity | Request syntax valid but semantic error | `{ "error": "Invalid email format" }` |
| **429** | Too Many Requests | Rate limit exceeded | `Retry-After: 60` |

**5xx Server Error Codes:**

| Code | Name | When to Use |
|------|------|-------------|
| **500** | Internal Server Error | Unexpected server error (bug, crash) |
| **501** | Not Implemented | Feature not yet implemented |
| **502** | Bad Gateway | Gateway/upstream service error |
| **503** | Service Unavailable | Server overloaded or maintenance |
| **504** | Gateway Timeout | Upstream service timeout |

**Status Code Usage Examples:**

<details>
<summary>Click to view code (python)</summary>

```python
from fastapi import FastAPI, HTTPException, status

app = FastAPI()

@app.post("/api/users", status_code=201)
async def create_user(data: UserCreate):
    # Check duplicate
    if db.user_exists(data.email):
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )
    
    user = db.create_user(data)
    return user

@app.get("/api/users/{user_id}")
async def get_user(user_id: int):
    user = db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User {user_id} not found"
        )
    return user

@app.put("/api/users/{user_id}")
async def update_user(user_id: int, data: UserUpdate):
    user = db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404)
    
    # Full update
    updated = db.update_user(user_id, data)
    return updated

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int):
    user = db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404)
    
    db.delete_user(user_id)
    return Response(status_code=204)  # No content

@app.get("/api/data")
async def get_data_with_range(request: Request):
    if_none_match = request.headers.get("If-None-Match")
    
    data = get_latest_data()
    etag = f'"{hash(data)}"'
    
    # Client has latest version
    if if_none_match == etag:
        return Response(status_code=304)  # Not modified
    
    response = JSONResponse(data)
    response.headers["ETag"] = etag
    return response

@app.get("/api/legacy-endpoint")
async def legacy():
    # Endpoint moved
    return Response(
        status_code=301,
        headers={"Location": "/api/v2/new-endpoint"}
    )
```

</details>

---

### 3. Versioning Strategies

**Option 1: URL Path (Most Common)**

```
GET /api/v1/users
GET /api/v2/users

Pros: Clear, easy to route
Cons: URL proliferation, multiple implementations
```


**Option 2: Query Parameter**

```
GET /api/users?version=2

Pros: Single URL endpoint
Cons: Less clear, harder to cache
```

**Option 3: Header**

```
GET /api/users
Accept: application/vnd.api+json;version=2

Pros: Elegant, no URL pollution
Cons: Complex, clients might not support
```

**Option 4: Content Negotiation**

```
GET /api/users
Accept: application/json;version=2

Pros: Standard HTTP
Cons: Confusing for non-technical users
```

**Recommendation**: **Use URL path versioning** (v1, v2, v3)
- Clear and explicit
- Most developers expect it
- Easy to route differently
- Simple to deprecate old versions

---

### 4. Request/Response Structure

**Standard Request Format**:
<details>
<summary>Click to view code (json)</summary>

```json
{
  "data": {
    "type": "users",
    "attributes": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "relationships": {
      "company": {
        "data": { "type": "companies", "id": "456" }
      }
    }
  }
}
```

</details>

**Standard Response Format (JSON:API)**:
<details>
<summary>Click to view code (json)</summary>

```json
{
  "data": [
    {
      "type": "users",
      "id": "123",
      "attributes": {
        "name": "John Doe",
        "email": "john@example.com",
        "createdAt": "2024-01-15T10:30:00Z"
      },
      "relationships": {
        "company": {
          "data": { "type": "companies", "id": "456" }
        },
        "posts": {
          "data": [
            { "type": "posts", "id": "789" }
          ]
        }
      }
    }
  ],
  "included": [
    {
      "type": "companies",
      "id": "456",
      "attributes": { "name": "Acme Corp" }
    }
  ],
  "meta": {
    "totalCount": 150,
    "pageSize": 20,
    "page": 1
  },
  "links": {
    "self": "/api/v1/users?page=1&limit=20",
    "next": "/api/v1/users?page=2&limit=20",
    "last": "/api/v1/users?page=8&limit=20"
  }
}
```

</details>

**Error Response Format**:
<details>
<summary>Click to view code (json)</summary>

```json
{
  "errors": [
    {
      "status": 400,
      "code": "INVALID_EMAIL",
      "title": "Invalid Email Format",
      "detail": "The email 'notanemail' is not a valid email address",
      "source": {
        "pointer": "/data/attributes/email"
      }
    }
  ]
}
```

</details>

**Alternative Error Response (simpler)**:
<details>
<summary>Click to view code (json)</summary>

```json
{
  "error": "invalid_request",
  "error_description": "The email 'notanemail' is not a valid email address",
  "error_uri": "https://api.example.com/docs/errors#invalid_email"
}
```

</details>

**Validation Error Response (multiple fields)**:
<details>
<summary>Click to view code (json)</summary>

```json
{
  "errors": {
    "email": "Invalid email format",
    "phone": "Phone number must be 10 digits",
    "age": "Age must be between 18 and 120"
  }
}
```

</details>

---

## Pagination Strategies

### 1. Offset-Based Pagination (Most Common)

**How it works**: Skip N records, take M records

```
GET /api/users?offset=0&limit=20   # First 20
GET /api/users?offset=20&limit=20  # Next 20 (skip 20, take 20)
GET /api/users?offset=40&limit=20  # Next 20 (skip 40, take 20)
```


**Pros:**
- Simple to implement
- Users can jump to any page
- Works with any database

**Cons:**
- **Offset problem**: Large offsets are slow
  ```sql
  SELECT * FROM users OFFSET 1000000 LIMIT 20
  -- Database must scan 1M records to skip them
  ```

- Data consistency issues (records can be inserted between requests)
- Less efficient with large datasets

**Implementation**:

<details>
<summary>Click to view code</summary>

```python
@app.get("/api/users")
def list_users(offset: int = 0, limit: int = 20):
    # Validate
    if offset < 0 or limit > 100:
        return error("Invalid pagination")
    
    users = db.query(User).offset(offset).limit(limit).all()
    total = db.query(User).count()
    
    return {
        "data": users,
        "pagination": {
            "offset": offset,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }
```
</details>

---

### 2. Cursor-Based Pagination (Recommended for Large Datasets)

**How it works**: Use a pointer (cursor) to mark position

```
GET /api/users?cursor=abc123&limit=20    # Get 20 after cursor
GET /api/users?cursor=next_cursor&limit=20
```

**Cursor is typically**: Base64 encoded string like `eyJpZCI6IDEwMDB9`

**Pros:**
- Efficient for large datasets
- Immune to data insertion/deletion between requests
- Works well with streaming
- Cursor can encode sorting criteria

**Cons:**
- Cannot jump to arbitrary page
- Cannot go backwards (or complex to implement)
- Requires encoded cursor format
- Not for simple use cases

**Implementation**:
<details>
<summary>Click to view code</summary>

```python
@app.get("/api/users")
def list_users(cursor: Optional[str] = None, limit: int = 20):
    if cursor:
        # Decode cursor: eyJpZCI6IDEwMDB9 -> {"id": 1000}
        cursor_data = json.loads(base64.b64decode(cursor))
        last_id = cursor_data['id']
        # Get records AFTER this ID
        query = db.query(User).filter(User.id > last_id)
    else:
        query = db.query(User)
    
    # Get limit + 1 to check if more data exists
    users = query.order_by(User.id).limit(limit + 1).all()
    
    has_more = len(users) > limit
    users = users[:limit]
    
    # Generate next cursor
    if users and has_more:
        next_cursor = base64.b64encode(
            json.dumps({"id": users[-1].id}).encode()
        ).decode()
    else:
        next_cursor = None
    
    return {
        "data": users,
        "pagination": {
            "cursor": next_cursor,
            "hasMore": has_more
        }
    }
```
</details>

---

### 3. Page-Based Pagination (User-Friendly)

**How it works**: Page number (1, 2, 3...) with page size

```
GET /api/users?page=1&pageSize=20   # First page
GET /api/users?page=2&pageSize=20   # Second page
```

**Pros:**
- Intuitive for users (page 1, page 2, page 3)
- Works with UI components (pagination buttons)
- Similar to offset (often implemented using offset)

**Cons:**
- Same issues as offset for large pages
- "Go to page 1000000" is inefficient
- Data consistency issues

**Implementation**:
<details>
<summary>Click to view code</summary>

```python
@app.get("/api/users")
def list_users(page: int = 1, pageSize: int = 20):
    offset = (page - 1) * pageSize
    users = db.query(User).offset(offset).limit(pageSize).all()
    total = db.query(User).count()
    
    return {
        "data": users,
        "pagination": {
            "page": page,
            "pageSize": pageSize,
            "totalCount": total,
            "totalPages": (total + pageSize - 1) // pageSize
        }
    }
```
</details>
---

### 4. Seek-Based Pagination (High-Performance)

**How it works**: Use WHERE clause to find next batch of records

```
GET /api/users?seekId=1000&limit=20
-- Gets records where id > 1000, limit 20
```

**Pros:**
- Extremely fast for large datasets
- Works naturally with indexes
- No offset scanning needed

**Cons:**
- Requires sortable unique column
- Cannot skip backward
- Requires reverse cursor for backward pagination

**Implementation**:
<details>
<summary>Click to view code</summary>

```python
@app.get("/api/users")
def list_users(seekId: Optional[int] = None, limit: int = 20):
    if seekId:
        query = db.query(User).filter(User.id > seekId)
    else:
        query = db.query(User)
    
    users = query.order_by(User.id).limit(limit + 1).all()
    
    has_more = len(users) > limit
    users = users[:limit]
    
    next_seek_id = users[-1].id if users else None
    
    return {
        "data": users,
        "pagination": {
            "nextSeekId": next_seek_id,
            "hasMore": has_more
        }
    }
```

</details>

---

### Pagination Comparison

| Strategy | Speed | User Experience | Use Case |
|----------|-------|-----------------|----------|
| **Offset** | Slow for large offsets | Good (page numbers) | Small datasets, admin UIs |
| **Cursor** | Fast, consistent | Medium (no direct jump) | Large datasets, mobile apps |
| **Page** | Slow for high pages | Excellent (obvious) | CRUD apps, user-facing UIs |
| **Seek** | Very fast | Poor (no direct access) | Real-time feeds, logs, streams |

**Recommendation**:
- **< 10K records**: Use offset (simplicity)
- **10K - 1M records**: Use page with caching
- **> 1M records**: Use cursor or seek
- **Streams/feeds**: Use cursor or seek only

---

## REST API Optimization Techniques

### 1. Filtering & Querying

**Good filtering**:
```
GET /api/users?status=active&role=admin&createdAfter=2024-01-01
GET /api/posts?authorId=123&tags=javascript,rust&minLikes=100
```

**Implementation**:
<details>
<summary>Click to view code</summary>

```python
@app.get("/api/users")
def list_users(
    status: Optional[str] = None,
    role: Optional[str] = None,
    createdAfter: Optional[datetime] = None
):
    query = db.query(User)
    
    if status:
        query = query.filter(User.status == status)
    if role:
        query = query.filter(User.role == role)
    if createdAfter:
        query = query.filter(User.created_at > createdAfter)
    
    return query.all()
```
</details>

---

### 2. Sorting

**Query parameters for sorting**:
```
GET /api/users?sort=createdAt:desc,name:asc
GET /api/posts?sort=-createdAt,+title        # - for desc, + for asc
```

**Implementation**:
<details>
<summary>Click to view code</summary>

```python
@app.get("/api/users")
def list_users(sort: Optional[str] = None):
    query = db.query(User)
    
    if sort:
        for field_spec in sort.split(','):
            if field_spec.startswith('-'):
                field_name = field_spec[1:]
                query = query.order_by(
                    getattr(User, field_name).desc()
                )
            else:
                field_name = field_spec.lstrip('+')
                query = query.order_by(
                    getattr(User, field_name)
                )
    
    return query.all()
```
</details>

---

### 3. Field Selection (Sparse Fieldsets)

**Allow clients to request only needed fields**:
```
GET /api/users?fields=id,name,email
// Returns only these fields, reduces payload
```

**Implementation**:
<details>
<summary>Click to view code</summary>

```python
@app.get("/api/users")
def list_users(fields: Optional[str] = None):
    query = db.query(User)
    users = query.all()
    
    if fields:
        allowed_fields = fields.split(',')
        return [
            {f: getattr(u, f) for f in allowed_fields if hasattr(u, f)}
            for u in users
        ]
    return users
```
</details>

---

### 4. Caching Headers

**Implement HTTP caching properly**:
<details>
<summary>Click to view code</summary>

```python
@app.get("/api/users/{user_id}")
def get_user(user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    
    response = Response(json.dumps(user))
    
    # Cache for 5 minutes
    response.headers["Cache-Control"] = "public, max-age=300"
    
    # ETag for conditional requests
    response.headers["ETag"] = f'"{hash(user)}"'
    
    return response

# Client respects these headers
# GET /api/users/123
# Response includes: Cache-Control, ETag
# 
# GET /api/users/123 (within 5 minutes)
# Browser uses cached version (304 Not Modified)
#
# After 5 minutes:
# GET /api/users/123
# If-None-Match: "hash123"
# Server returns 304 (not changed) or 200 with new data
```

</details>

---

### 5. Compression

**Enable gzip compression**:
<details>
<summary>Click to view code</summary>

```python
from fastapi.middleware.gzip import GZIPMiddleware

app.add_middleware(GZIPMiddleware, minimum_size=1000)
# Responses > 1KB are gzip compressed automatically
```

</details>

**Bandwidth reduction**:
```
Before: 100KB JSON response
After:  10KB gzipped (90% reduction)
```

---

### 6. Rate Limiting

**Prevent abuse**:
<details>
<summary>Click to view code</summary>

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/api/users")
@limiter.limit("100/minute")
def list_users(request: Request):
    return db.query(User).all()
```
</details>

---

### 7. Async/Non-blocking

**Use async for I/O-heavy operations**:

<details>
<summary>Click to view code</summary>

```python
@app.get("/api/users")
async def list_users():
    users = await db.query(User).all()  # Non-blocking
    return users
```

</details>

---

## gRPC Best Practices

### 1. Proto Definition Design

**Good proto definition**:
<details>
<summary>Click to view code</summary>

```protobuf
syntax = "proto3";

package user.v1;

option go_package = "github.com/company/user/v1";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty);
  rpc StreamUsers(Empty) returns (stream User);
}

message GetUserRequest {
  int64 user_id = 1;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
  string filter = 3;
}

message ListUsersResponse {
  repeated User users = 1;
  string next_page_token = 2;
  int32 total_count = 3;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}

message User {
  int64 id = 1;
  string name = 2;
  string email = 3;
  string status = 4;
  int64 created_at = 5;  // Unix timestamp
}

message UpdateUserRequest {
  int64 id = 1;
  google.protobuf.StringValue name = 2;  // Optional field
  google.protobuf.StringValue email = 3;
}

message DeleteUserRequest {
  int64 user_id = 1;
}

message Empty {}
```

</details>

**Key points:**
- Start field numbering at 1
- Never reuse field numbers
- Use google.protobuf types for optional fields
- Use repeated for arrays
- Always version your API (v1, v2 in package)

---

### 2. Types of gRPC Communication Patterns

gRPC supports 4 types of communication patterns, each optimized for different use cases.

---

#### Type 1: Unary RPC (Request-Response)

**How it works**: Client sends single request, server sends single response (like REST)

**Proto definition**:
<details>
<summary>Click to view code</summary>

```protobuf
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
}

message GetUserRequest {
  int64 user_id = 1;
}

message User {
  int64 id = 1;
  string name = 2;
  string email = 3;
}
```

</details>

**Implementation (Python)**:
<details>
<summary>Click to view code</summary>

```python
# Server
class UserServicer:
    def GetUser(self, request, context):
        user = db.get_user(request.user_id)
        if not user:
            context.abort(
                grpc.StatusCode.NOT_FOUND,
                f"User {request.user_id} not found"
            )
        return User(
            id=user.id,
            name=user.name,
            email=user.email
        )

# Client
stub = UserServiceStub(channel)
response = stub.GetUser(GetUserRequest(user_id=123))
print(f"User: {response.name}")
```

</details>

**Use cases**:
- CRUD operations
- Authentication/authorization
- Simple queries
- Microservice-to-microservice calls
- When request-response is sufficient

**Pros**:
- Simple to implement
- Easy to understand
- Works like REST

**Cons**:
- Not efficient for large data
- No real-time updates

---

#### Type 2: Server Streaming RPC

**How it works**: Client sends single request, server sends stream of responses

**Proto definition**:

<details>
<summary>Click to view code</summary>

```protobuf
service LogService {
  rpc StreamLogs(LogRequest) returns (stream LogEntry);
  rpc DownloadFile(FileRequest) returns (stream FileChunk);
}

message LogRequest {
  string service_name = 1;
  int64 since_timestamp = 2;
}

message LogEntry {
  int64 timestamp = 1;
  string level = 2;
  string message = 3;
}

message FileChunk {
  bytes data = 1;
  int32 chunk_number = 2;
}
```
</details>

**Implementation**:
<details>
<summary>Click to view code</summary>

```python
# Server
class LogServicer:
    def StreamLogs(self, request, context):
        """Stream logs as they arrive"""
        # Get initial logs
        logs = db.get_logs(
            service=request.service_name,
            since=request.since_timestamp
        )
        
        for log in logs:
            yield LogEntry(
                timestamp=log.timestamp,
                level=log.level,
                message=log.message
            )
            
            # Check if client disconnected
            if context.is_active() == False:
                break
    
    def DownloadFile(self, request, context):
        """Stream file in chunks"""
        file_path = get_file_path(request.file_id)
        chunk_size = 64 * 1024  # 64KB chunks
        
        with open(file_path, 'rb') as f:
            chunk_number = 0
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                
                yield FileChunk(
                    data=chunk,
                    chunk_number=chunk_number
                )
                chunk_number += 1

# Client
stub = LogServiceStub(channel)

# Receive stream
for log_entry in stub.StreamLogs(LogRequest(service_name="api")):
    print(f"[{log_entry.level}] {log_entry.message}")

# Download file
with open('downloaded_file', 'wb') as f:
    for chunk in stub.DownloadFile(FileRequest(file_id="abc123")):
        f.write(chunk.data)
        print(f"Downloaded chunk {chunk.chunk_number}")
```
</details>

**Use cases**:
- **Real-time logs/monitoring**: Stream logs as they're generated
- **Large file downloads**: Split into chunks to avoid memory issues
- **Live updates**: Stock prices, sports scores, sensor data
- **Notifications**: Push notifications to clients
- **Data export**: Export large datasets incrementally
- **Video/audio streaming**: Stream media content

**Pros**:
- Memory efficient (no need to load entire response)
- Real-time updates
- Client can process data incrementally
- Can cancel early

**Cons**:
- More complex than unary
- Server needs to manage connection state

---

#### Type 3: Client Streaming RPC

**How it works**: Client sends stream of requests, server sends single response

**Proto definition**:
<details>
<summary>Click to view code</summary>

```protobuf
service UploadService {
  rpc UploadFile(stream FileChunk) returns (UploadResponse);
  rpc RecordMetrics(stream Metric) returns (MetricsSummary);
}

message FileChunk {
  bytes data = 1;
  string filename = 2;
  int32 chunk_number = 3;
}

message UploadResponse {
  string file_id = 1;
  int64 total_bytes = 2;
  string status = 3;
}

message Metric {
  string name = 1;
  double value = 2;
  int64 timestamp = 3;
}

message MetricsSummary {
  int32 total_metrics = 1;
  double average_value = 2;
}
```
</details>

**Implementation**:
<details>
<summary>Click to view code</summary>

```python
# Server
class UploadServicer:
    def UploadFile(self, request_iterator, context):
        """Receive file in chunks"""
        file_id = generate_file_id()
        file_path = f"/tmp/{file_id}"
        total_bytes = 0
        
        with open(file_path, 'wb') as f:
            for chunk in request_iterator:
                f.write(chunk.data)
                total_bytes += len(chunk.data)
                print(f"Received chunk {chunk.chunk_number}")
        
        # Store in database or cloud storage
        store_file(file_id, file_path)
        
        return UploadResponse(
            file_id=file_id,
            total_bytes=total_bytes,
            status="SUCCESS"
        )
    
    def RecordMetrics(self, request_iterator, context):
        """Receive batch of metrics"""
        metrics = []
        
        for metric in request_iterator:
            metrics.append(metric)
            # Optionally store in database
            db.insert_metric(metric)
        
        total = len(metrics)
        avg = sum(m.value for m in metrics) / total if total > 0 else 0
        
        return MetricsSummary(
            total_metrics=total,
            average_value=avg
        )

# Client
stub = UploadServiceStub(channel)

# Upload file
def generate_chunks(file_path):
    chunk_size = 64 * 1024  # 64KB
    with open(file_path, 'rb') as f:
        chunk_number = 0
        while True:
            data = f.read(chunk_size)
            if not data:
                break
            
            yield FileChunk(
                data=data,
                filename=os.path.basename(file_path),
                chunk_number=chunk_number
            )
            chunk_number += 1

response = stub.UploadFile(generate_chunks('large_file.zip'))
print(f"Uploaded: {response.file_id}, {response.total_bytes} bytes")

# Send metrics batch
def generate_metrics():
    for i in range(1000):
        yield Metric(
            name="cpu_usage",
            value=random.uniform(0, 100),
            timestamp=int(time.time())
        )

summary = stub.RecordMetrics(generate_metrics())
print(f"Sent {summary.total_metrics} metrics, avg: {summary.average_value}")
```
</details>

**Use cases**:
- **File uploads**: Upload large files in chunks
- **Batch data ingestion**: Send batches of events/metrics
- **IoT sensor data**: Devices send continuous sensor readings
- **Log aggregation**: Clients send log batches
- **Audio/video uploads**: Upload media in chunks

**Pros**:
- Memory efficient for client (stream large data)
- Can send data as it's generated
- Server processes incrementally
- Single response reduces overhead

**Cons**:
- Server must handle partial data
- Error handling complex
- Client needs retry logic

---

#### Type 4: Bidirectional Streaming RPC

**How it works**: Both client and server send streams of messages independently

**Proto definition**:
```protobuf
service ChatService {
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
  rpc Collaborate(stream EditOperation) returns (stream EditOperation);
}

message ChatMessage {
  string user_id = 1;
  string message = 2;
  int64 timestamp = 3;
}

message EditOperation {
  string document_id = 1;
  string operation = 2;  // insert, delete, update
  int32 position = 3;
  string content = 4;
  string user_id = 5;
}

```

**Implementation**:
<details>
<summary>Click to view code</summary>

```python
# Server
class ChatServicer:
    def __init__(self):
        self.active_chats = {}  # room_id -> list of queues
    
    def Chat(self, request_iterator, context):
        """Bidirectional chat"""
        # Create queue for this client
        client_queue = asyncio.Queue()
        room_id = None
        
        async def receive_messages():
            """Receive messages from client"""
            nonlocal room_id
            async for message in request_iterator:
                room_id = message.room_id
                
                # Register client in room
                if room_id not in self.active_chats:
                    self.active_chats[room_id] = []
                if client_queue not in self.active_chats[room_id]:
                    self.active_chats[room_id].append(client_queue)
                
                # Broadcast to all clients in room
                for queue in self.active_chats[room_id]:
                    if queue != client_queue:  # Don't echo back
                        await queue.put(message)
        
        async def send_messages():
            """Send messages to client"""
            while True:
                message = await client_queue.get()
                yield message
        
        # Start receiving in background
        asyncio.create_task(receive_messages())
        
        # Stream messages to client
        async for message in send_messages():
            yield message
        
        # Cleanup on disconnect
        if room_id and room_id in self.active_chats:
            self.active_chats[room_id].remove(client_queue)

# Client
class ChatClient:
    def __init__(self, stub):
        self.stub = stub
        self.message_queue = queue.Queue()
    
    def start_chat(self, room_id, user_id):
        def generate_messages():
            """Generate messages from user input"""
            while True:
                text = self.message_queue.get()
                if text == "QUIT":
                    break
                yield ChatMessage(
                    room_id=room_id,
                    user_id=user_id,
                    message=text,
                    timestamp=int(time.time())
                )
        
        # Start bidirectional stream
        responses = self.stub.Chat(generate_messages())
        
        # Receive messages
        for message in responses:
            print(f"[{message.user_id}]: {message.message}")
    
    def send_message(self, text):
        """Add message to queue"""
        self.message_queue.put(text)

# Usage
client = ChatClient(stub)
thread = threading.Thread(
    target=client.start_chat,
    args=("room123", "user456")
)
thread.start()

# Send messages
client.send_message("Hello everyone!")
client.send_message("How are you?")
```
</details>

**Use cases**:
- **Real-time chat**: Messages flow both ways
- **Live collaboration**: Google Docs-style editing
- **Multiplayer games**: Game state updates
- **Video/audio calls**: WebRTC signaling
- **Live trading**: Order updates and market data
- **Collaborative whiteboards**: Drawing operations

**Pros**:
- True real-time bidirectional communication
- Each side streams independently
- Very efficient (single connection)
- Low latency

**Cons**:
- Most complex to implement
- Requires careful state management
- Error handling challenging
- Testing difficult

---

### Comparison of gRPC Types

| Type | Client Sends | Server Sends | Use Case | Complexity |
|------|-------------|--------------|----------|------------|
| **Unary** | 1 message | 1 message | CRUD operations | Low |
| **Server Streaming** | 1 message | Many messages | Live updates, large downloads | Medium |
| **Client Streaming** | Many messages | 1 message | File uploads, batch ingestion | Medium |
| **Bidirectional** | Many messages | Many messages | Chat, collaboration | High |

---

---

### 3. Error Handling

**Use gRPC error codes**:

<details>
<summary>Click to view code</summary>

```python
from grpc import StatusCode

def get_user(request):
    user = db.get_user(request.user_id)
    if not user:
        raise RpcError(
            code=StatusCode.NOT_FOUND,
            details=f"User {request.user_id} not found"
        )
    return user

def create_user(request):
    if not is_valid_email(request.email):
        raise RpcError(
            code=StatusCode.INVALID_ARGUMENT,
            details="Email format invalid"
        )
    return db.create(User(**request))
```
</details>

**gRPC Status Codes:**
- `OK`: Success
- `CANCELLED`: Operation cancelled
- `UNKNOWN`: Unknown error
- `INVALID_ARGUMENT`: Bad input
- `DEADLINE_EXCEEDED`: Timeout
- `NOT_FOUND`: Resource not found
- `ALREADY_EXISTS`: Duplicate
- `PERMISSION_DENIED`: Unauthorized
- `RESOURCE_EXHAUSTED`: Quota exceeded
- `FAILED_PRECONDITION`: Wrong state
- `ABORTED`: Concurrent conflict
- `OUT_OF_RANGE`: Index out of range
- `UNIMPLEMENTED`: Not implemented
- `INTERNAL`: Internal error
- `UNAVAILABLE`: Service unavailable
- `DATA_LOSS`: Data lost

---

### 4. Interceptors (Middleware)

**Authentication interceptor**:

<details>
<summary>Click to view code</summary>

```python
class AuthInterceptor(grpc.ServerInterceptor):
    def intercept_service(self, continuation, handler_call_details):
        metadata = handler_call_details.invocation_metadata
        
        token = None
        for key, value in metadata:
            if key == 'authorization':
                token = value
        
        if not token or not validate_token(token):
            raise RpcError(
                code=StatusCode.UNAUTHENTICATED,
                details="Invalid token"
            )
        
        return continuation(handler_call_details)
```

</details>

---

### 5. Performance Optimization

**Connection pooling**:
<details>
<summary>Click to view code</summary>

```python
# Server supports multiplexing by default
# Multiple requests share one connection

# Client: Reuse channel
channel = grpc.aio.secure_channel(
    'user-service:50051',
    grpc.ssl_channel_credentials()
)
stub = UserServiceStub(channel)

# Make multiple calls on same channel
users = stub.ListUsers(ListUsersRequest())
user = stub.GetUser(GetUserRequest(user_id=123))
```

</details>

**Compression**:
```protobuf
// In proto file
service UserService {
  rpc GetUser(GetUserRequest) returns (User) {
    option (google.api.http) = {
      get: "/v1/users/{user_id}"
    };
  }
}
```

---

## Interview Questions & Answers

### Q1: How would you design REST API pagination for a feed of 100M events?

**Answer:**

**Requirements analysis:**
- 100M events (very large)
- Typical use case: Social feed, logs, notifications
- Users expect chronological ordering (newest first)

**Solution: Cursor-based pagination with seek**

<details>
<summary>Click to view code</summary>

```python
from datetime import datetime
from typing import Optional

@app.get("/api/feed")
async def get_feed(
    cursor: Optional[str] = None,
    limit: int = 20
):
    # Cursor is base64 encoded JSON: {"timestamp": 1704067200, "id": 12345}
    if cursor:
        cursor_data = json.loads(base64.b64decode(cursor))
        query = db.query(Event).filter(
            (Event.timestamp < cursor_data['timestamp']) |
            ((Event.timestamp == cursor_data['timestamp']) & 
             (Event.id < cursor_data['id']))
        )
    else:
        query = db.query(Event)
    
    # Get limit + 1 to check if more exists
    events = (
        query
        .order_by(Event.timestamp.desc(), Event.id.desc())
        .limit(limit + 1)
        .all()
    )
    
    has_more = len(events) > limit
    events = events[:limit]
    
    # Generate next cursor from last event
    if events and has_more:
        last_event = events[-1]
        next_cursor = base64.b64encode(
            json.dumps({
                "timestamp": int(last_event.timestamp.timestamp()),
                "id": last_event.id
            }).encode()
        ).decode()
    else:
        next_cursor = None
    
    return {
        "data": events,
        "pagination": {
            "cursor": next_cursor,
            "hasMore": has_more
        }
    }
```
</details>

**Why cursor?**
- No offset scanning (super fast)
- Handles insertion/deletion between requests
- Client can't accidentally skip data
- Works with high-frequency streams

**Why timestamp + id?**
- Timestamp for ordering
- ID for tie-breaking (duplicates at same timestamp)

---

### Q2: REST vs gRPC for microservices. What factors would you consider?

**Answer:**

**Decision matrix:**

| Factor | REST Better | gRPC Better |
|--------|------------|-----------|
| **Team familiarity** | Less experienced | Familiar with binary protocols |
| **Performance required** | 100ms acceptable | <10ms required |
| **Bandwidth constrained** | No | Yes (mobile, IoT) |
| **Browser clients** | Yes | No (needs proxy) |
| **Complex queries** | Yes (REST flexible) | No (fixed schema) |
| **Long-lived connections** | No | Yes |
| **Streaming data** | Complex | Native |
| **API evolution** | Easier (flexible) | Harder (breaking changes) |

**My recommendation: Hybrid approach**

```
API Gateway (REST) ← Clients (web, mobile, partners)
    ↓
Converts REST → gRPC
    ↓
Microservices (gRPC for internal)
  ├─ User Service
  ├─ Post Service
  ├─ Comment Service
  └─ Analytics Service
```

**Implementation example:**
<details>
<summary>Click to view code</summary>

```python
# API Gateway: REST endpoint
@app.get("/api/users/{user_id}")
async def get_user(user_id: int):
    # Convert to gRPC call
    response = await grpc_user_service.GetUser(
        GetUserRequest(user_id=user_id)
    )
    
    # Convert protobuf response to JSON for REST client
    return {
        "id": response.id,
        "name": response.name,
        "email": response.email
    }
```
</details>

**Benefits:**
- External clients use familiar REST
- Internal services use efficient gRPC
- Gateway handles protocol translation
- Best of both worlds

---

### Q3: Design a caching strategy for REST API with TTL. Consider stale data.

**Answer:**

**Requirements:**
- Some data changes frequently (user posts: minutes)
- Some rarely changes (user profile: hours)
- Cannot serve stale data beyond threshold

**Solution: Variable TTL with cache invalidation**
<details>
<summary>Click to view code</summary>

```python
from functools import wraps
from datetime import datetime, timedelta
import redis

cache = redis.Redis()

def cached_endpoint(ttl_seconds=300, key_prefix=""):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{key_prefix}:{':'.join(map(str, args))}"
            
            # Try cache
            cached = cache.get(cache_key)
            if cached:
                return json.loads(cached)
            
            # Cache miss: call function
            result = await func(*args, **kwargs)
            
            # Store with TTL
            cache.setex(
                cache_key,
                ttl_seconds,
                json.dumps(result)
            )
            
            return result
        return wrapper
    return decorator

# Different TTL by data type
@app.get("/api/users/{user_id}")
@cached_endpoint(ttl_seconds=3600, key_prefix="user")  # 1 hour
async def get_user(user_id: int):
    return db.get_user(user_id)

@app.get("/api/users/{user_id}/posts")
@cached_endpoint(ttl_seconds=300, key_prefix="user_posts")  # 5 minutes
async def get_user_posts(user_id: int):
    return db.get_user_posts(user_id)

# Cache invalidation on updates
@app.put("/api/users/{user_id}")
async def update_user(user_id: int, data: UpdateUserRequest):
    user = db.update_user(user_id, data)
    
    # Invalidate cache
    cache.delete(f"user:{user_id}")
    cache.delete(f"user_posts:{user_id}")
    
    return user
```
</details>

**Advanced: Stale-while-revalidate**
<details>
<summary>Click to view code</summary>

```python
@app.get("/api/users/{user_id}")
async def get_user(user_id: int):
    cache_key = f"user:{user_id}"
    
    # Try cache
    cached = cache.get(cache_key)
    if cached:
        data = json.loads(cached)
        
        # Still valid
        if not is_stale(data):
            return data
        
        # Return stale data but revalidate in background
        asyncio.create_task(revalidate_user(user_id))
        return data
    
    # No cache: fetch and cache
    user = db.get_user(user_id)
    cache.setex(cache_key, 3600, json.dumps(user))
    return user

async def revalidate_user(user_id: int):
    """Background task to refresh cache"""
    user = db.get_user(user_id)
    cache.setex(f"user:{user_id}", 3600, json.dumps(user))
```
</details>

---

### Q4: How would you handle versioning for a REST API used by 1000+ external clients?

**Answer:**

**Challenge:** Cannot break 1000 clients at once

**Solution: Semantic versioning with deprecation window**
<details>
<summary>Click to view code</summary>

```python
from datetime import datetime

# Version 1: Original API
@app.get("/api/v1/users/{user_id}")
def get_user_v1(user_id: int):
    return db.get_user(user_id)

# Version 2: Added new field
@app.get("/api/v2/users/{user_id}")
def get_user_v2(user_id: int):
    user = db.get_user(user_id)
    return {
        **user,
        "createdAt": user.created_at,  # New field
        "updatedAt": user.updated_at   # New field
    }

# Deprecation management
DEPRECATION_SCHEDULE = {
    "v1": {
        "deprecated_date": datetime(2024, 1, 1),
        "sunset_date": datetime(2025, 1, 1),  # Final deadline
        "message": "API v1 is deprecated. Please migrate to v2 by Jan 1, 2025"
    }
}

@app.middleware("http")
async def deprecation_headers(request, call_next):
    version = extract_api_version(request.url.path)
    
    if version in DEPRECATION_SCHEDULE:
        schedule = DEPRECATION_SCHEDULE[version]
        response = await call_next(request)
        
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = schedule["sunset_date"].isoformat()
        response.headers["Warning"] = f'299 - "{schedule["message"]}"'
        
        return response
    
    return await call_next(request)
```
</details>

**Deprecation strategy:**
```
Month 1-6: v1 + v2, deprecation headers
Month 7-11: v1 (limited support) + v2 (default)
Month 12: v1 support ends, hard cutoff
```

---

### Q5: Design gRPC for a payment service handling 10K transactions/sec.

**Answer:**

**Requirements:**
- High throughput (10K/sec)
- Low latency (<100ms)
- Strict consistency (no data loss)
- High availability

**Solution: gRPC with streaming and circuit breaker**

```protobuf
syntax = "proto3";

package payment.v1;

service PaymentService {
  rpc ProcessPayment(PaymentRequest) returns (PaymentResponse);
  rpc StreamPayments(stream PaymentRequest) returns (stream PaymentResponse);
  rpc GetStatus(TransactionId) returns (PaymentStatus);
}

message PaymentRequest {
  string idempotency_key = 1;  // Prevents duplicates
  string user_id = 2;
  int64 amount_cents = 3;
  string currency = 4;
  string description = 5;
  map<string, string> metadata = 6;
}

message PaymentResponse {
  string transaction_id = 1;
  string status = 2;  // PENDING, SUCCESS, FAILED
  int64 timestamp = 3;
}

message PaymentStatus {
  string transaction_id = 1;
  string status = 2;
  int64 processed_at = 3;
}

message TransactionId {
  string id = 1;
}

```

**Implementation:**
<details>
<summary>Click to view code</summary>

```python
import grpc
from concurrent import futures

class PaymentServicer:
    def __init__(self):
        self.db = Database()
        self.queue = MessageQueue()  # Kafka for reliability
        self.cache = Cache()  # Redis for idempotency
    
    async def ProcessPayment(self, request, context):
        # Idempotency check
        cached = await self.cache.get(request.idempotency_key)
        if cached:
            return cached  # Return cached response
        
        # Validate
        if request.amount_cents <= 0:
            await context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                "Amount must be positive"
            )
        
        try:
            # Enqueue for processing
            transaction_id = await self.queue.enqueue({
                "type": "payment",
                "user_id": request.user_id,
                "amount": request.amount_cents,
                "currency": request.currency,
                "idempotency_key": request.idempotency_key
            })
            
            response = PaymentResponse(
                transaction_id=transaction_id,
                status="PENDING",
                timestamp=int(time.time())
            )
            
            # Cache response for idempotency
            await self.cache.set(
                request.idempotency_key,
                response,
                ttl=3600  # 1 hour
            )
            
            return response
        
        except Exception as e:
            await context.abort(
                grpc.StatusCode.INTERNAL,
                f"Payment processing failed: {str(e)}"
            )
    
    async def StreamPayments(self, request_iterator, context):
        """Handle batch payments with streaming"""
        async for payment_request in request_iterator:
            response = await self.ProcessPayment(payment_request, context)
            yield response

# Server setup with connection pooling
async def serve():
    server = grpc.aio.server(
        futures.ThreadPoolExecutor(max_workers=100),
        options=[
            ('grpc.max_concurrent_streams', 500),
            ('grpc.max_receive_message_length', 10 * 1024 * 1024),
            ('grpc.max_send_message_length', 10 * 1024 * 1024),
        ]
    )
    
    PaymentServicer = payment_pb2_grpc.PaymentServiceServicer()
    payment_pb2_grpc.add_PaymentServiceServicer_to_server(
        PaymentServicer, server
    )
    
    server.add_secure_port('[::]:50051', server_credentials)
    
    await server.start()
    await server.wait_for_termination()
```
</details>

**Client implementation with circuit breaker:**

<details>
<summary>Click to view code</summary>

```python
class PaymentClient:
    def __init__(self):
        self.channel = grpc.aio.secure_channel(
            'payment-service:50051',
            grpc.ssl_channel_credentials()
        )
        self.stub = PaymentServiceStub(self.channel)
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            timeout=60
        )
    
    async def process_payment(self, request):
        if self.circuit_breaker.is_open():
            raise ServiceUnavailableError("Payment service degraded")
        
        try:
            response = await self.stub.ProcessPayment(request)
            self.circuit_breaker.record_success()
            return response
        except grpc.RpcError as e:
            self.circuit_breaker.record_failure()
            raise
```
</details>

**Key optimizations:**
- Idempotency key prevents duplicate charges
- Message queue ensures reliability
- Streaming for batch processing
- Connection pooling and multiplexing
- Circuit breaker prevents cascade failures
- Async/await for concurrency

---

### Q6: Explain the 4 types of gRPC communication patterns and when to use each.

**Answer:**

**1. Unary RPC (Request-Response)**
```protobuf
rpc GetUser(GetUserRequest) returns (User);
```

**When to use:**
- Standard CRUD operations
- Authentication/authorization
- Simple queries
- Microservice-to-microservice calls
- Equivalent to REST APIs

**Example**: `GetUser`, `CreateOrder`, `UpdateProfile`

---

**2. Server Streaming RPC**
```protobuf
rpc StreamLogs(LogRequest) returns (stream LogEntry);
```

**When to use:**
- Real-time updates (logs, notifications)
- Large file downloads (split into chunks)
- Live data feeds (stock prices, sensor data)
- Data export (large datasets)
- When response is too large for single message

**Example use case:**
```python
# Server
def StreamLogs(self, request, context):
    # Stream logs as they arrive
    while True:
        log = log_queue.get()  # Get new log
        yield LogEntry(message=log)

# Client receives stream
for log in stub.StreamLogs(LogRequest()):
    print(log.message)
```

**Advantages:**
- Memory efficient (no need to buffer entire response)
- Client can process data incrementally
- Real-time updates
- Can cancel early if needed

---

**3. Client Streaming RPC**
```protobuf
rpc UploadFile(stream FileChunk) returns (UploadResponse);
```

**When to use:**
- Large file uploads
- Batch data ingestion (metrics, logs)
- IoT device data streams
- Audio/video recording uploads
- When request is too large for single message

<details>
<summary>Click to view code</summary>

**Example use case:**

```python
# Client sends stream
def upload_file(file_path):
    def generate_chunks():
        with open(file_path, 'rb') as f:
            while chunk := f.read(64 * 1024):
                yield FileChunk(data=chunk)
    
    response = stub.UploadFile(generate_chunks())
    print(f"Uploaded: {response.file_id}")

# Server receives stream
def UploadFile(self, request_iterator, context):
    with open(output_file, 'wb') as f:
        for chunk in request_iterator:
            f.write(chunk.data)
    return UploadResponse(file_id="abc123")
```

</details>

**Advantages:**
- Memory efficient for client
- Can send data as it's generated
- Server processes incrementally
- Single response reduces overhead

---

**4. Bidirectional Streaming RPC**
```protobuf
rpc Chat(stream Message) returns (stream Message);
```

**When to use:**
- Real-time chat applications
- Live collaboration (Google Docs)
- Multiplayer games
- Video/audio calls (WebRTC signaling)
- Live trading platforms
- When both sides need to send data concurrently

<details>
<summary>Click to view code</summary>

**Example use case:**
```python
# Server
def Chat(self, request_iterator, context):
    # Receive and broadcast messages
    for message in request_iterator:
        # Broadcast to all connected clients
        for client in active_clients:
            yield message

# Client
def chat():
    def generate_messages():
        while True:
            text = input("Enter message: ")
            yield ChatMessage(text=text)
    
    # Bidirectional stream
    responses = stub.Chat(generate_messages())
    for response in responses:
        print(f"Received: {response.text}")
```
</details>

**Advantages:**
- True real-time communication
- Single connection for both directions
- Very low latency
- Each side streams independently

---

**Decision matrix:**

| Scenario | Use Type | Reason |
|----------|---------|--------|
| Get user by ID | Unary | Simple request-response |
| Download 1GB file | Server streaming | Split into chunks |
| Upload video | Client streaming | Send in chunks |
| Real-time chat | Bidirectional | Both sides send/receive |
| Stock price feed | Server streaming | Continuous updates |
| Batch log ingestion | Client streaming | Send many logs, one ack |
| Collaborative editing | Bidirectional | Edits flow both ways |

---

### Q7: Compare REST and gRPC for a real-time chat application. Which would you choose?

**Answer:**

**Requirements analysis:**
- Real-time bidirectional communication
- Low latency (<100ms)
- High message throughput
- Connection persistence
- Multiple concurrent users

**REST approach (with WebSocket or SSE):**

```python
# REST requires workaround for real-time
# Option 1: Long polling (inefficient)
GET /api/messages?since=timestamp
# Client polls every second

# Option 2: WebSocket (not REST)
ws://chat.example.com/socket
# Requires separate WebSocket server

# Option 3: Server-Sent Events (one-way)
GET /api/messages/stream
# Only server -> client, needs separate endpoint for client -> server

```

**Issues with REST:**
- Long polling: Inefficient, high latency
- WebSocket: Not HTTP/2, separate protocol
- SSE: One-way only
- No native streaming support
- JSON parsing overhead
- Larger payload size

---

**gRPC approach (native bidirectional streaming):**

```protobuf
service ChatService {
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}

message ChatMessage {
  string user_id = 1;
  string room_id = 2;
  string message = 3;
  int64 timestamp = 4;
}
```

**Implementation:**

<details>
<summary>Click to view code</summary>

```python
# Server
class ChatServicer:
    def __init__(self):
        self.rooms = {}  # room_id -> list of client queues
    
    async def Chat(self, request_iterator, context):
        client_queue = asyncio.Queue()
        room_id = None
        
        async def receive():
            nonlocal room_id
            async for msg in request_iterator:
                room_id = msg.room_id
                # Add client to room
                if room_id not in self.rooms:
                    self.rooms[room_id] = []
                self.rooms[room_id].append(client_queue)
                
                # Broadcast to all in room
                for queue in self.rooms[room_id]:
                    if queue != client_queue:
                        await queue.put(msg)
        
        async def send():
            while True:
                msg = await client_queue.get()
                yield msg
        
        asyncio.create_task(receive())
        async for msg in send():
            yield msg

# Client
async def chat(stub, user_id, room_id):
    async def send_messages():
        while True:
            text = await asyncio.get_event_loop().run_in_executor(
                None, input, "Message: "
            )
            yield ChatMessage(
                user_id=user_id,
                room_id=room_id,
                message=text
            )
    
    async for msg in stub.Chat(send_messages()):
        print(f"[{msg.user_id}]: {msg.message}")
```

</details>

**Benefits of gRPC:**
- Native bidirectional streaming
- Single persistent connection
- Binary protocol (Protobuf) = smaller payloads
- HTTP/2 multiplexing
- Built-in flow control
- Lower latency
- Better performance

---

**Performance comparison:**

| Metric | REST + WebSocket | gRPC Bidirectional |
|--------|-----------------|--------------------|
| Latency | 50-100ms | 10-30ms |
| Payload size | 500 bytes (JSON) | 100 bytes (Protobuf) |
| Connection overhead | High (separate WS) | Low (HTTP/2) |
| CPU usage | High (JSON parsing) | Low (binary) |
| Bandwidth | 10 MB/min | 2 MB/min |

**My recommendation: gRPC**

**Why:**
- Native support for bidirectional streaming
- Lower latency and bandwidth
- Simpler architecture (no WebSocket server)
- Better performance at scale
- Type safety with Protobuf

**Trade-off:**
- gRPC requires proxy for browser clients (gRPC-Web)
- REST + WebSocket is more familiar to web developers

**Architecture:**
```


Mobile/Desktop clients → gRPC bidirectional streaming → Chat Service

Web clients → gRPC-Web (Envoy proxy) → gRPC → Chat Service


```

---

### Q8: How does gRPC handle load balancing and connection management?

**Answer:**

**Challenge with gRPC:**
Unlike REST (new connection per request), gRPC uses **persistent HTTP/2 connections** with **multiplexing**.

**Problem:**
```
Client creates 1 connection → Load balancer → Server A
   All requests on this connection go to Server A
   Server B, C are idle (connection-level balancing doesn't work)


```

---

**Solution 1: Client-Side Load Balancing (Recommended)**

**How it works:**
- Client maintains connection pool to multiple servers
- Client decides which server to send each request
- Client uses service discovery to find available servers

**Implementation:**

<details>
<summary>Click to view code</summary>

```python
import grpc
from grpc import health

# Service discovery (e.g., Consul, etcd)
server_addresses = service_discovery.get_servers("chat-service")
# Returns: ["server1:50051", "server2:50051", "server3:50051"]

# Create channels to all servers
channels = [
    grpc.insecure_channel(addr) for addr in server_addresses
]

# Round-robin load balancing
class LoadBalancingClient:
    def __init__(self, channels):
        self.channels = channels
        self.current = 0
        self.stubs = [
            ChatServiceStub(ch) for ch in channels
        ]
    
    def send_message(self, request):
        # Pick next server
        stub = self.stubs[self.current]
        self.current = (self.current + 1) % len(self.stubs)
        
        try:
            return stub.SendMessage(request)
        except grpc.RpcError:
            # Retry on next server
            return self.send_message(request)

client = LoadBalancingClient(channels)
```

</details>

**Using gRPC's built-in load balancing:**
```python
# DNS-based service discovery
channel = grpc.insecure_channel(
    'dns:///chat-service:50051',
    options=[
        ('grpc.lb_policy_name', 'round_robin'),
        ('grpc.max_connection_idle_ms', 10000),
    ]
)

stub = ChatServiceStub(channel)

```

**Pros:**
- No extra infrastructure
- Client controls load balancing
- Can implement custom algorithms (least loaded, geo-aware)

**Cons:**
- Client complexity
- Service discovery needed
- Client must handle server failures

---

**Solution 2: Proxy-Based Load Balancing (Envoy)**

**How it works:**
- Deploy Envoy proxy as sidecar or centralized
- Envoy terminates client connection
- Envoy creates multiple connections to backend servers
- Envoy distributes RPC calls across connections

**Architecture:**
```

Client → Envoy Proxy → Server A (connection pool: 10 connections)
                     → Server B (connection pool: 10 connections)
                     → Server C (connection pool: 10 connections)
```

**Envoy configuration:**
```yaml
static_resources:
  listeners:
  - name: grpc_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 50051
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          http2_protocol_options: {}
          stat_prefix: grpc
          route_config:
            virtual_hosts:
            - name: backend
              domains: ["*"]
              routes:
              - match: { prefix: "/" }
                route:
                  cluster: chat_service
          http_filters:
          - name: envoy.filters.http.router
  
  clusters:
  - name: chat_service
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    http2_protocol_options: {}
    load_assignment:
      cluster_name: chat_service
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: server1
                port_value: 50051
        - endpoint:
            address:
              socket_address:
                address: server2
                port_value: 50051
```

**Pros:**
- Transparent to client
- Centralized control
- Advanced features (retry, circuit breaking, observability)
- Works with any client

**Cons:**
- Extra infrastructure
- Added latency
- Single point of failure (need HA setup)

---

**Solution 3: Service Mesh (Istio/Linkerd)**

**How it works:**
- Sidecar proxy per pod/service
- Automatic load balancing
- Built-in retry, circuit breaking
- mTLS, observability

**Kubernetes deployment:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: chat-service
spec:
  selector:
    app: chat
  ports:
  - port: 50051
    name: grpc
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-service
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: chat
    spec:
      containers:
      - name: chat
        image: chat-service:v1
        ports:
        - containerPort: 50051
```

**Istio virtual service:**
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: chat-service
spec:
  hosts:
  - chat-service
  http:
  - route:
    - destination:
        host: chat-service
      weight: 100
    retries:
      attempts: 3
      perTryTimeout: 2s
```

**Pros:**
- Fully automated
- Zero code changes
- Rich features (tracing, metrics, security)
- Works across all services

**Cons:**
- Complex setup
- Kubernetes required
- Resource overhead

---

**Connection Management Best Practices:**

<details>
<summary>Click to view code</summary>

```python
# 1. Connection pooling
class ConnectionPool:
    def __init__(self, target, pool_size=10):
        self.channels = [
            grpc.insecure_channel(target) for _ in range(pool_size)
        ]
        self.current = 0
    
    def get_channel(self):
        channel = self.channels[self.current]
        self.current = (self.current + 1) % len(self.channels)
        return channel

# 2. Health checking
from grpc_health.v1 import health_pb2, health_pb2_grpc

def check_server_health(channel):
    stub = health_pb2_grpc.HealthStub(channel)
    request = health_pb2.HealthCheckRequest(service="ChatService")
    response = stub.Check(request)
    return response.status == health_pb2.HealthCheckResponse.SERVING

# 3. Retry with exponential backoff
from grpc import StatusCode

def call_with_retry(stub, method, request, max_retries=3):
    for attempt in range(max_retries):
        try:
            return method(request)
        except grpc.RpcError as e:
            if e.code() in [StatusCode.UNAVAILABLE, StatusCode.DEADLINE_EXCEEDED]:
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
            raise

# 4. Connection keepalive
channel = grpc.insecure_channel(
    'server:50051',
    options=[
        ('grpc.keepalive_time_ms', 10000),
        ('grpc.keepalive_timeout_ms', 5000),
        ('grpc.keepalive_permit_without_calls', True),
        ('grpc.http2.max_pings_without_data', 0),
    ]
)
```

</details>

**Recommendation:**
- **Small systems**: Client-side load balancing
- **Medium systems**: Envoy proxy
- **Large systems (Kubernetes)**: Service mesh (Istio)

---

### Q9: Design a retry strategy for gRPC in a microservices architecture.

**Answer:**

**Challenge:**
- Network failures happen
- Services can be temporarily unavailable
- Need to retry without overwhelming failed services
- Avoid cascading failures

**Solution: Retry with Exponential Backoff + Circuit Breaker**

<details>
<summary>Click to view code</summary>

```python
import grpc
import time
from enum import Enum
from typing import Optional

class CircuitState(Enum):
    CLOSED = "closed"        # Normal operation
    OPEN = "open"            # Failing, don't retry
    HALF_OPEN = "half_open"  # Testing recovery

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold=5,
        timeout=60,
        expected_exception=grpc.RpcError
    ):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.state = CircuitState.CLOSED
        self.opened_at = None
    
    def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            # Check if timeout passed
            if time.time() - self.opened_at >= self.timeout:
                self.state = CircuitState.HALF_OPEN
                print("Circuit breaker: Half-open, testing...")
            else:
                raise Exception("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            # Success
            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                print("Circuit breaker: Closed")
            return result
        
        except self.expected_exception as e:
            self.failure_count += 1
            
            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
                self.opened_at = time.time()
                print(f"Circuit breaker: OPEN (failures: {self.failure_count})")
            
            raise

class RetryConfig:
    def __init__(
        self,
        max_attempts=3,
        initial_backoff=0.1,
        max_backoff=10.0,
        backoff_multiplier=2.0,
        retryable_codes=None
    ):
        self.max_attempts = max_attempts
        self.initial_backoff = initial_backoff
        self.max_backoff = max_backoff
        self.backoff_multiplier = backoff_multiplier
        self.retryable_codes = retryable_codes or [
            grpc.StatusCode.UNAVAILABLE,
            grpc.StatusCode.DEADLINE_EXCEEDED,
            grpc.StatusCode.RESOURCE_EXHAUSTED,
        ]

class GrpcClient:
    def __init__(self, channel):
        self.channel = channel
        self.circuit_breaker = CircuitBreaker()
        self.retry_config = RetryConfig()
    
    def call_with_retry(self, stub_method, request):
        """Call gRPC method with retry and circuit breaker"""
        
        def make_call():
            backoff = self.retry_config.initial_backoff
            
            for attempt in range(self.retry_config.max_attempts):
                try:
                    print(f"Attempt {attempt + 1}/{self.retry_config.max_attempts}")
                    return stub_method(request)
                
                except grpc.RpcError as e:
                    # Check if retryable
                    if e.code() not in self.retry_config.retryable_codes:
                        print(f"Non-retryable error: {e.code()}")
                        raise
                    
                    # Last attempt, don't sleep
                    if attempt == self.retry_config.max_attempts - 1:
                        print(f"Max retries reached")
                        raise
                    
                    # Exponential backoff
                    print(f"Error {e.code()}, retrying in {backoff}s...")
                    time.sleep(backoff)
                    backoff = min(
                        backoff * self.retry_config.backoff_multiplier,
                        self.retry_config.max_backoff
                    )
        
        # Use circuit breaker
        return self.circuit_breaker.call(make_call)

# Usage
channel = grpc.insecure_channel('localhost:50051')
stub = ChatServiceStub(channel)
client = GrpcClient(channel)

try:
    response = client.call_with_retry(
        stub.SendMessage,
        ChatMessage(text="Hello")
    )
    print(f"Success: {response}")
except Exception as e:
    print(f"Failed after retries: {e}")
```

</details>

**Built-in gRPC retry (simpler):**

<details>
<summary>Click to view code</summary>

```python
# Service config with retry policy
service_config = {
    "methodConfig": [
        {
            "name": [{"service": "ChatService"}],
            "retryPolicy": {
                "maxAttempts": 5,
                "initialBackoff": "0.1s",
                "maxBackoff": "10s",
                "backoffMultiplier": 2,
                "retryableStatusCodes": [
                    "UNAVAILABLE",
                    "DEADLINE_EXCEEDED"
                ]
            },
            "timeout": "30s"
        }
    ]
}

channel = grpc.insecure_channel(
    'localhost:50051',
    options=[
        ('grpc.service_config', json.dumps(service_config)),
        ('grpc.enable_retries', 1),
    ]
)

stub = ChatServiceStub(channel)
response = stub.SendMessage(ChatMessage(text="Hello"))
# Retries automatically
```

</details>

**Retry Strategy Summary:**

| Aspect | Strategy |
|--------|----------|
| **Retryable errors** | UNAVAILABLE, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED |
| **Non-retryable** | INVALID_ARGUMENT, NOT_FOUND, PERMISSION_DENIED |
| **Max attempts** | 3-5 |
| **Backoff** | Exponential (0.1s, 0.2s, 0.4s, 0.8s, ...) |
| **Max backoff** | 10s |
| **Circuit breaker** | Open after 5 consecutive failures |
| **Timeout** | 30s per attempt |

**Best practices:**
1. Use idempotency keys for write operations
2. Implement circuit breaker to prevent cascades
3. Add jitter to backoff (avoid thundering herd)
4. Monitor retry rates
5. Set reasonable timeouts
