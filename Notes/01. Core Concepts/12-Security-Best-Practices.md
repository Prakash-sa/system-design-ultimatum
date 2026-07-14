# Security Best Practices

## Table of Contents
1. [Authentication & Authorization](#authentication--authorization)
2. [API Security Best Practices](#api-security-best-practices)
3. [Data Security](#data-security)
4. [Network Security](#network-security)
5. [Application Security](#application-security)
6. [Infrastructure Security](#infrastructure-security)
7. [Compliance & Privacy](#compliance--privacy)
8. [Interview Questions & Answers](#interview-questions--answers)

---

## Authentication & Authorization

### Authentication Mechanisms

#### 1. Password-Based Authentication

**Best Practices:**

<details>
<summary>Click to view code (python)</summary>

```python
import bcrypt
import secrets
from datetime import datetime, timedelta

class AuthService:
    def __init__(self):
        self.min_password_length = 12
        self.password_requirements = {
            'uppercase': True,
            'lowercase': True,
            'digits': True,
            'special_chars': True
        }
    
    def hash_password(self, password: str) -> bytes:
        """Hash password using bcrypt with salt"""
        # bcrypt automatically generates and stores salt
        salt = bcrypt.gensalt(rounds=12)  # Cost factor 12
        return bcrypt.hashpw(password.encode('utf-8'), salt)
    
    def verify_password(self, password: str, hashed: bytes) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), hashed)
    
    def validate_password_strength(self, password: str) -> tuple[bool, str]:
        """Validate password meets security requirements"""
        if len(password) < self.min_password_length:
            return False, f"Password must be at least {self.min_password_length} characters"
        
        if not any(c.isupper() for c in password):
            return False, "Password must contain uppercase letter"
        
        if not any(c.islower() for c in password):
            return False, "Password must contain lowercase letter"
        
        if not any(c.isdigit() for c in password):
            return False, "Password must contain digit"
        
        special = set('!@#$%^&*()_+-=[]{}|;:,.<>?')
        if not any(c in special for c in password):
            return False, "Password must contain special character"
        
        # Check against common passwords
        if self.is_common_password(password):
            return False, "Password is too common"
        
        return True, "Password is strong"
    
    def is_common_password(self, password: str) -> bool:
        """Check against list of common passwords"""
        common_passwords = [
            'password', '123456', '12345678', 'qwerty',
            'abc123', 'monkey', '1234567', 'letmein'
        ]
        return password.lower() in common_passwords
```

</details>

**Key Points:**
- Use bcrypt, scrypt, or Argon2 for password hashing (NOT MD5/SHA1)
- Minimum 12 characters
- Require uppercase, lowercase, digits, special characters
- Check against common password lists
- Implement account lockout after N failed attempts
- Use rate limiting on login endpoints

---

#### 2. Multi-Factor Authentication (MFA)

**TOTP (Time-based One-Time Password) Implementation:**

<details>
<summary>Click to view code (python)</summary>

```python
import pyotp
import qrcode
from io import BytesIO

class MFAService:
    def generate_secret(self, user_email: str) -> dict:
        """Generate MFA secret for user"""
        secret = pyotp.random_base32()
        
        # Generate QR code
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user_email,
            issuer_name="MyApp"
        )
        
        # Create QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        return {
            'secret': secret,
            'qr_code': img,
            'provisioning_uri': provisioning_uri
        }
    
    def verify_totp(self, secret: str, token: str) -> bool:
        """Verify TOTP token"""
        totp = pyotp.TOTP(secret)
        # Allow 1 time step before/after (30 seconds window)
        return totp.verify(token, valid_window=1)
    
    def generate_backup_codes(self, count: int = 10) -> list[str]:
        """Generate backup codes for MFA recovery"""
        codes = []
        for _ in range(count):
            code = secrets.token_hex(4).upper()  # 8 character code
            codes.append(code)
        return codes

# Usage
mfa = MFAService()

# Setup MFA for user
mfa_data = mfa.generate_secret("user@example.com")
print(f"Secret: {mfa_data['secret']}")
print(f"Scan QR code with authenticator app")

# Verify user's token
is_valid = mfa.verify_totp(mfa_data['secret'], "123456")

# Generate backup codes
backup_codes = mfa.generate_backup_codes()
print(f"Backup codes: {backup_codes}")
```

</details>

**MFA Best Practices:**
- Require MFA for admin accounts
- Offer multiple MFA methods (TOTP, SMS, email, hardware keys)
- Provide backup codes for account recovery
- Don't allow MFA bypass without proper verification
- Log all MFA events

---

#### 3. Token-Based Authentication

#### JWT (JSON Web Token) Implementation

<details>
<summary>Click to view code (python)</summary>

```python
import jwt
from datetime import datetime, timedelta
from typing import Optional

class JWTService:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key
        self.algorithm = 'HS256'
        self.access_token_expire = timedelta(minutes=15)
        self.refresh_token_expire = timedelta(days=7)
    
    def create_access_token(
        self,
        user_id: str,
        additional_claims: dict = None
    ) -> str:
        """Create short-lived access token"""
        expire = datetime.utcnow() + self.access_token_expire
        
        payload = {
            'sub': user_id,
            'exp': expire,
            'iat': datetime.utcnow(),
            'type': 'access'
        }
        
        if additional_claims:
            payload.update(additional_claims)
        
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(self, user_id: str) -> str:
        """Create long-lived refresh token"""
        expire = datetime.utcnow() + self.refresh_token_expire
        
        payload = {
            'sub': user_id,
            'exp': expire,
            'iat': datetime.utcnow(),
            'type': 'refresh',
            'jti': secrets.token_hex(16)  # Token ID for revocation
        }
        
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str) -> Optional[dict]:
        """Verify and decode token"""
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise Exception("Token expired")
        except jwt.InvalidTokenError:
            raise Exception("Invalid token")
    
    def refresh_access_token(self, refresh_token: str) -> str:
        """Generate new access token from refresh token"""
        payload = self.verify_token(refresh_token)
        
        if payload.get('type') != 'refresh':
            raise Exception("Invalid token type")
        
        # Check if refresh token is blacklisted
        if self.is_token_blacklisted(payload.get('jti')):
            raise Exception("Token revoked")
        
        return self.create_access_token(payload['sub'])
    
    def is_token_blacklisted(self, token_id: str) -> bool:
        """Check if token is blacklisted (implement with Redis)"""
        # Implementation with Redis
        return False

# Usage
jwt_service = JWTService(secret_key="your-secret-key-min-32-chars")

# Login
access_token = jwt_service.create_access_token(
    user_id="user123",
    additional_claims={'role': 'admin'}
)
refresh_token = jwt_service.create_refresh_token("user123")

# Verify token
payload = jwt_service.verify_token(access_token)
print(f"User: {payload['sub']}, Role: {payload['role']}")

# Refresh token
new_access_token = jwt_service.refresh_access_token(refresh_token)
```

</details>

**JWT Best Practices:**
- Use strong secret keys (min 256 bits)
- Use RS256 for microservices (asymmetric keys)
- Short expiration for access tokens (15 min)
- Implement token refresh mechanism
- Store refresh tokens securely (HttpOnly cookies)
- Implement token blacklist for logout
- Include minimal claims (don't store sensitive data)
- Validate all claims (exp, iat, iss, aud)

---

#### OAuth 2.0 / OpenID Connect

<details>
<summary>Click to view code (python)</summary>

```python
from authlib.integrations.flask_client import OAuth
from flask import Flask, redirect, url_for, session

app = Flask(__name__)
app.secret_key = 'secret-key'

oauth = OAuth(app)

# Configure OAuth provider (Google example)
google = oauth.register(
    name='google',
    client_id='YOUR_GOOGLE_CLIENT_ID',
    client_secret='YOUR_GOOGLE_CLIENT_SECRET',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

@app.route('/login')
def login():
    """Redirect to OAuth provider"""
    redirect_uri = url_for('authorize', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/authorize')
def authorize():
    """OAuth callback"""
    token = google.authorize_access_token()
    user_info = google.parse_id_token(token)
    
    # Store user info in session
    session['user'] = {
        'id': user_info['sub'],
        'email': user_info['email'],
        'name': user_info['name']
    }
    
    return redirect('/dashboard')

@app.route('/logout')
def logout():
    """Logout user"""
    session.pop('user', None)
    return redirect('/')
```

</details>

**OAuth 2.0 Best Practices:**
- Use authorization code flow (not implicit flow)
- Implement PKCE (Proof Key for Code Exchange)
- Validate redirect URIs strictly
- Use state parameter to prevent CSRF
- Store tokens securely
- Implement token refresh
- Use HTTPS only
- Validate ID tokens properly

---

### Authorization (Access Control)

#### Role-Based Access Control (RBAC)

<details>
<summary>Click to view code (python)</summary>

```python
from enum import Enum
from typing import Set

class Role(Enum):
    ADMIN = "admin"
    USER = "user"
    MODERATOR = "moderator"
    GUEST = "guest"

class Permission(Enum):
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"

class RBACService:
    def __init__(self):
        # Define role permissions
        self.role_permissions = {
            Role.ADMIN: {
                Permission.READ,
                Permission.WRITE,
                Permission.DELETE,
                Permission.ADMIN
            },
            Role.MODERATOR: {
                Permission.READ,
                Permission.WRITE,
                Permission.DELETE
            },
            Role.USER: {
                Permission.READ,
                Permission.WRITE
            },
            Role.GUEST: {
                Permission.READ
            }
        }
    
    def has_permission(
        self,
        user_role: Role,
        required_permission: Permission
    ) -> bool:
        """Check if role has permission"""
        permissions = self.role_permissions.get(user_role, set())
        return required_permission in permissions
    
    def has_any_permission(
        self,
        user_role: Role,
        required_permissions: Set[Permission]
    ) -> bool:
        """Check if role has any of the required permissions"""
        role_permissions = self.role_permissions.get(user_role, set())
        return bool(role_permissions & required_permissions)

# Decorator for permission checking
from functools import wraps
from flask import request, jsonify

def require_permission(permission: Permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get user from token/session
            user_role = get_user_role_from_token()
            
            rbac = RBACService()
            if not rbac.has_permission(user_role, permission):
                return jsonify({'error': 'Forbidden'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Usage
@app.route('/api/users/<user_id>', methods=['DELETE'])
@require_permission(Permission.DELETE)
def delete_user(user_id):
    # Only roles with DELETE permission can access
    db.delete_user(user_id)
    return jsonify({'status': 'deleted'})
```

</details>

---

#### Attribute-Based Access Control (ABAC)

<details>
<summary>Click to view code (python)</summary>

```python
from typing import Dict, Any

class ABACService:
    def evaluate_policy(
        self,
        user_attributes: Dict[str, Any],
        resource_attributes: Dict[str, Any],
        action: str,
        environment: Dict[str, Any]
    ) -> bool:
        """Evaluate access based on attributes"""
        
        # Rule 1: Admin can do anything
        if user_attributes.get('role') == 'admin':
            return True
        
        # Rule 2: Users can read their own data
        if action == 'read' and user_attributes['id'] == resource_attributes.get('owner_id'):
            return True
        
        # Rule 3: Users can write during business hours
        if action == 'write':
            if user_attributes.get('role') == 'user':
                hour = environment.get('hour', 0)
                if 9 <= hour <= 17:  # Business hours
                    return True
        
        # Rule 4: Department-based access
        if user_attributes.get('department') == resource_attributes.get('department'):
            if action in ['read', 'write']:
                return True
        
        return False

# Usage
abac = ABACService()

user = {'id': 'user123', 'role': 'user', 'department': 'engineering'}
resource = {'id': 'doc456', 'owner_id': 'user123', 'department': 'engineering'}
environment = {'hour': 14, 'ip': '192.168.1.1'}

can_write = abac.evaluate_policy(user, resource, 'write', environment)
```

</details>

**Authorization Best Practices:**
- Implement least privilege principle
- Use RBAC for simple scenarios
- Use ABAC for complex policies
- Centralize authorization logic
- Log all authorization decisions
- Regularly audit permissions
- Implement deny by default

---

## API Security Best Practices

### 1. Input Validation & Sanitization

<details>
<summary>Click to view code (python)</summary>

```python
from typing import Any
import re
from html import escape

class InputValidator:
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    @staticmethod
    def validate_phone(phone: str) -> bool:
        """Validate phone number"""
        pattern = r'^\+?1?\d{9,15}$'
        return bool(re.match(pattern, phone))
    
    @staticmethod
    def sanitize_string(text: str) -> str:
        """Sanitize string for XSS prevention"""
        # Remove HTML tags
        text = re.sub(r'<[^>]*>', '', text)
        # Escape special characters
        text = escape(text)
        return text.strip()
    
    @staticmethod
    def validate_integer(value: Any, min_val: int = None, max_val: int = None) -> bool:
        """Validate integer with range"""
        try:
            val = int(value)
            if min_val is not None and val < min_val:
                return False
            if max_val is not None and val > max_val:
                return False
            return True
        except (ValueError, TypeError):
            return False
    
    @staticmethod
    def validate_uuid(uuid_string: str) -> bool:
        """Validate UUID format"""
        pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        return bool(re.match(pattern, uuid_string.lower()))

# SQL Injection Prevention
from sqlalchemy import text

class SafeDatabase:
    def get_user(self, user_id: str):
        """SAFE: Use parameterized queries"""
        query = text("SELECT * FROM users WHERE id = :user_id")
        result = db.execute(query, {'user_id': user_id})
        return result.fetchone()
    
    def search_users_unsafe(self, search: str):
        """UNSAFE: String concatenation"""
        # NEVER DO THIS
        query = f"SELECT * FROM users WHERE name = '{search}'"
        # Attacker can inject: ' OR '1'='1
    
    def search_users_safe(self, search: str):
        """SAFE: Parameterized query"""
        query = text("SELECT * FROM users WHERE name = :search")
        result = db.execute(query, {'search': search})
        return result.fetchall()

# NoSQL Injection Prevention
class MongoDBSafe:
    def get_user(self, username: str):
        """SAFE: Validate input"""
        if not isinstance(username, str):
            raise ValueError("Username must be string")
        
        # Use exact match, not query operators
        return db.users.find_one({'username': username})
    
    def get_user_unsafe(self, username_data):
        """UNSAFE: Accepting dict allows injection"""
        # NEVER DO THIS
        # Attacker can send: {'$gt': ''}
        return db.users.find_one({'username': username_data})
```

</details>

**Input Validation Best Practices:**
- Validate all inputs (type, format, range, length)
- Use allowlist validation (not blocklist)
- Sanitize output to prevent XSS
- Use parameterized queries (prevent SQL injection)
- Validate JSON schema
- Reject unexpected fields
- Use strong typing (TypeScript, Pydantic)

---

### 2. Rate Limiting & Throttling

<details>
<summary>Click to view code (python)</summary>

```python
from datetime import datetime, timedelta
from collections import defaultdict
import time

class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)
        self.limits = {
            'default': (100, 60),      # 100 requests per minute
            'login': (5, 300),          # 5 requests per 5 minutes
            'api': (1000, 3600),        # 1000 requests per hour
            'premium': (10000, 3600)    # 10000 requests per hour
        }
    
    def is_allowed(
        self,
        client_id: str,
        endpoint_type: str = 'default'
    ) -> tuple[bool, dict]:
        """Check if request is allowed"""
        max_requests, window_seconds = self.limits.get(
            endpoint_type,
            self.limits['default']
        )
        
        now = time.time()
        window_start = now - window_seconds
        
        # Get client's recent requests
        client_requests = self.requests[client_id]
        
        # Remove old requests outside window
        client_requests[:] = [
            req_time for req_time in client_requests
            if req_time > window_start
        ]
        
        # Check if limit exceeded
        if len(client_requests) >= max_requests:
            retry_after = int(client_requests[0] + window_seconds - now)
            return False, {
                'retry_after': retry_after,
                'limit': max_requests,
                'remaining': 0
            }
        
        # Add current request
        client_requests.append(now)
        
        return True, {
            'limit': max_requests,
            'remaining': max_requests - len(client_requests),
            'reset': int(now + window_seconds)
        }

# Redis-based Rate Limiter (Production)
import redis

class RedisRateLimiter:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
    
    def is_allowed(
        self,
        key: str,
        max_requests: int = 100,
        window_seconds: int = 60
    ) -> bool:
        """Rate limit using Redis"""
        now = time.time()
        window_key = f"ratelimit:{key}:{int(now / window_seconds)}"
        
        # Increment counter
        count = self.redis.incr(window_key)
        
        # Set expiration on first request
        if count == 1:
            self.redis.expire(window_key, window_seconds)
        
        return count <= max_requests

# Flask middleware
from flask import Flask, request, jsonify

app = Flask(__name__)
rate_limiter = RateLimiter()

@app.before_request
def rate_limit_middleware():
    """Apply rate limiting to all requests"""
    client_id = request.headers.get('X-API-Key') or request.remote_addr
    endpoint_type = 'api'
    
    # Special rate limit for login
    if request.path == '/api/login':
        endpoint_type = 'login'
    
    allowed, info = rate_limiter.is_allowed(client_id, endpoint_type)
    
    # Add rate limit headers
    response_headers = {
        'X-RateLimit-Limit': str(info['limit']),
        'X-RateLimit-Remaining': str(info['remaining'])
    }
    
    if 'reset' in info:
        response_headers['X-RateLimit-Reset'] = str(info['reset'])
    
    if not allowed:
        response_headers['Retry-After'] = str(info['retry_after'])
        return jsonify({
            'error': 'Rate limit exceeded',
            'retry_after': info['retry_after']
        }), 429, response_headers
    
    # Store headers for response
    request.rate_limit_headers = response_headers

@app.after_request
def add_rate_limit_headers(response):
    """Add rate limit headers to response"""
    if hasattr(request, 'rate_limit_headers'):
        for key, value in request.rate_limit_headers.items():
            response.headers[key] = value
    return response
```

</details>

**Rate Limiting Best Practices:**
- Implement per-user/IP rate limiting
- Different limits for different endpoints
- Use Redis for distributed rate limiting
- Return proper headers (X-RateLimit-*)
- Return 429 status code
- Implement exponential backoff
- Monitor rate limit metrics

---

### 3. API Authentication & API Keys

<details>
<summary>Click to view code (python)</summary>

```python
import secrets
import hashlib
from datetime import datetime

class APIKeyService:
    def generate_api_key(self, prefix: str = "sk") -> tuple[str, str]:
        """Generate API key and its hash"""
        # Generate random key
        random_part = secrets.token_urlsafe(32)
        api_key = f"{prefix}_{random_part}"
        
        # Hash for storage
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        return api_key, key_hash
    
    def verify_api_key(self, api_key: str, stored_hash: str) -> bool:
        """Verify API key against stored hash"""
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        return secrets.compare_digest(key_hash, stored_hash)
    
    def create_api_key_record(self, user_id: str, name: str) -> dict:
        """Create API key record for database"""
        api_key, key_hash = self.generate_api_key()
        
        record = {
            'user_id': user_id,
            'name': name,
            'key_hash': key_hash,
            'created_at': datetime.utcnow(),
            'last_used_at': None,
            'is_active': True,
            'rate_limit': 1000,  # Requests per hour
            'scopes': ['read', 'write']  # Permissions
        }
        
        # Return key only once (user must save it)
        return {
            'api_key': api_key,  # Show only once
            'record': record
        }

# Middleware for API key authentication
from flask import request, jsonify, g

def require_api_key(f):
    """Decorator to require API key"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        
        if not api_key:
            return jsonify({'error': 'API key required'}), 401
        
        # Validate format
        if not api_key.startswith('sk_'):
            return jsonify({'error': 'Invalid API key format'}), 401
        
        # Verify against database
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        key_record = db.get_api_key(key_hash)
        
        if not key_record:
            return jsonify({'error': 'Invalid API key'}), 401
        
        if not key_record['is_active']:
            return jsonify({'error': 'API key revoked'}), 401
        
        # Update last used
        db.update_api_key_last_used(key_hash)
        
        # Store user info for request
        g.user_id = key_record['user_id']
        g.api_key_scopes = key_record['scopes']
        
        return f(*args, **kwargs)
    return decorated_function

# Usage
@app.route('/api/data')
@require_api_key
def get_data():
    user_id = g.user_id
    return jsonify({'data': 'sensitive data', 'user': user_id})
```

</details>

**API Key Best Practices:**
- Use cryptographically secure random generation
- Store only hashed keys (like passwords)
- Use prefixes (sk_, pk_) for identification
- Implement key rotation
- Allow users to revoke keys
- Track key usage (last used, request count)
- Implement key scopes/permissions
- Set expiration dates
- Use HTTPS only

---

### 4. CORS (Cross-Origin Resource Sharing)

<details>
<summary>Click to view code (python)</summary>

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

# Restrictive CORS (Recommended for Production)
cors_config = {
    'origins': [
        'https://app.example.com',
        'https://admin.example.com'
    ],
    'methods': ['GET', 'POST', 'PUT', 'DELETE'],
    'allow_headers': ['Content-Type', 'Authorization'],
    'expose_headers': ['X-Total-Count'],
    'supports_credentials': True,
    'max_age': 3600
}

CORS(app, resources={r"/api/*": cors_config})

# Custom CORS middleware
@app.after_request
def add_cors_headers(response):
    """Add CORS headers manually"""
    origin = request.headers.get('Origin')
    
    # Allowlist of origins
    allowed_origins = [
        'https://app.example.com',
        'https://admin.example.com'
    ]
    
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Max-Age'] = '3600'
    
    return response
```

</details>

**CORS Best Practices:**
- Never use wildcard (*) in production
- Allowlist specific origins
- Validate Origin header
- Don't reflect Origin without validation
- Use credentials only when necessary
- Set appropriate cache time (max-age)
- Restrict methods and headers

---

### 5. HTTPS & TLS

<details>
<summary>Click to view code (python)</summary>

```python
# Force HTTPS in Flask
from flask import Flask, redirect, request

app = Flask(__name__)

@app.before_request
def force_https():
    """Redirect HTTP to HTTPS"""
    if not request.is_secure and app.config.get('ENV') == 'production':
        url = request.url.replace('http://', 'https://', 1)
        return redirect(url, code=301)

# Security headers
@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    return response
```

</details>

**HTTPS Best Practices:**
- Use TLS 1.3 (minimum TLS 1.2)
- Strong cipher suites only
- HSTS header (Strict-Transport-Security)
- Valid SSL certificates
- Certificate pinning for mobile apps
- Regular certificate renewal
- Disable older protocols (SSLv3, TLS 1.0, 1.1)

---

### 6. Request Signing & HMAC

<details>
<summary>Click to view code (python)</summary>

```python
import hmac
import hashlib
import time

class RequestSigner:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key.encode()
    
    def sign_request(
        self,
        method: str,
        path: str,
        body: str = '',
        timestamp: int = None
    ) -> str:
        """Generate HMAC signature for request"""
        if timestamp is None:
            timestamp = int(time.time())
        
        # Create signature payload
        message = f"{method}\n{path}\n{timestamp}\n{body}"
        
        # Generate HMAC
        signature = hmac.new(
            self.secret_key,
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def verify_request(
        self,
        method: str,
        path: str,
        body: str,
        signature: str,
        timestamp: int,
        max_age: int = 300  # 5 minutes
    ) -> bool:
        """Verify request signature"""
        # Check timestamp (prevent replay attacks)
        now = int(time.time())
        if abs(now - timestamp) > max_age:
            return False
        
        # Compute expected signature
        expected_signature = self.sign_request(method, path, body, timestamp)
        
        # Compare signatures (constant time)
        return hmac.compare_digest(signature, expected_signature)

# Flask middleware
@app.before_request
def verify_signature():
    """Verify request signature"""
    signature = request.headers.get('X-Signature')
    timestamp = request.headers.get('X-Timestamp')
    
    if not signature or not timestamp:
        return jsonify({'error': 'Missing signature'}), 401
    
    try:
        timestamp = int(timestamp)
    except ValueError:
        return jsonify({'error': 'Invalid timestamp'}), 401
    
    signer = RequestSigner(app.config['SECRET_KEY'])
    
    body = request.get_data(as_text=True)
    is_valid = signer.verify_request(
        request.method,
        request.path,
        body,
        signature,
        timestamp
    )
    
    if not is_valid:
        return jsonify({'error': 'Invalid signature'}), 401
```

</details>

**Request Signing Best Practices:**
- Use HMAC-SHA256 (minimum)
- Include timestamp to prevent replay
- Sign method, path, and body
- Use constant-time comparison
- Rotate secret keys regularly
- Implement nonce for additional security

---

## Data Security

### 1. Encryption at Rest

<details>
<summary>Click to view code (python)</summary>

```python
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import base64

class DataEncryption:
    def __init__(self, password: str, salt: bytes = None):
        """Initialize encryption with password"""
        if salt is None:
            salt = os.urandom(16)
        
        self.salt = salt
        
        # Derive key from password
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        self.cipher = Fernet(key)
    
    def encrypt(self, data: str) -> str:
        """Encrypt data"""
        encrypted = self.cipher.encrypt(data.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt data"""
        encrypted = base64.urlsafe_b64decode(encrypted_data)
        decrypted = self.cipher.decrypt(encrypted)
        return decrypted.decode()

# Field-level encryption for database
class User:
    def __init__(self, email: str, ssn: str):
        self.email = email
        self.ssn_encrypted = self.encrypt_ssn(ssn)
    
    @staticmethod
    def encrypt_ssn(ssn: str) -> str:
        """Encrypt sensitive field"""
        cipher = DataEncryption(os.environ['ENCRYPTION_KEY'])
        return cipher.encrypt(ssn)
    
    def get_ssn(self) -> str:
        """Decrypt sensitive field"""
        cipher = DataEncryption(os.environ['ENCRYPTION_KEY'])
        return cipher.decrypt(self.ssn_encrypted)

# Database encryption example
# Use transparent data encryption (TDE) for database
# PostgreSQL: Enable pgcrypto extension
# MySQL: Enable InnoDB encryption
# MongoDB: Enable encryption at rest
```

</details>

**Encryption at Rest Best Practices:**
- Encrypt sensitive data (PII, payment info, passwords)
- Use AES-256 for encryption
- Store encryption keys separately (KMS)
- Rotate encryption keys regularly
- Use database-level encryption (TDE)
- Encrypt backups
- Secure key management (AWS KMS, Azure Key Vault)

---

### 2. Encryption in Transit

<details>
<summary>Click to view code (python)</summary>

```python
# Use TLS for all connections
import requests

# GOOD: Verify SSL certificates
response = requests.get('https://api.example.com', verify=True)

# BAD: Don't verify (NEVER DO THIS)
response = requests.get('https://api.example.com', verify=False)

# Database connections with TLS
import psycopg2

conn = psycopg2.connect(
    host="db.example.com",
    database="mydb",
    user="user",
    password="pass",
    sslmode="require",  # Require TLS
    sslrootcert="/path/to/ca.crt"
)

# Redis with TLS
import redis

r = redis.Redis(
    host='redis.example.com',
    port=6380,
    ssl=True,
    ssl_cert_reqs='required',
    ssl_ca_certs='/path/to/ca.crt'
)
```

</details>

---

### 3. Data Masking & Tokenization

<details>
<summary>Click to view code (python)</summary>

```python
import re

class DataMasker:
    @staticmethod
    def mask_email(email: str) -> str:
        """Mask email address"""
        username, domain = email.split('@')
        if len(username) <= 2:
            masked_username = '*' * len(username)
        else:
            masked_username = username[0] + '*' * (len(username) - 2) + username[-1]
        return f"{masked_username}@{domain}"
    
    @staticmethod
    def mask_phone(phone: str) -> str:
        """Mask phone number"""
        return re.sub(r'\d(?=\d{4})', '*', phone)
    
    @staticmethod
    def mask_credit_card(card: str) -> str:
        """Mask credit card (show last 4 digits)"""
        return '*' * (len(card) - 4) + card[-4:]
    
    @staticmethod
    def mask_ssn(ssn: str) -> str:
        """Mask SSN (show last 4 digits)"""
        return '***-**-' + ssn[-4:]

# Usage
masker = DataMasker()
print(masker.mask_email("john.doe@example.com"))    # j******e@example.com
print(masker.mask_phone("555-123-4567"))             # ***-***-4567
print(masker.mask_credit_card("4532123456789012"))   # ************9012
print(masker.mask_ssn("123-45-6789"))                # ***-**-6789
```

</details>

---

## Network Security

### 1. DDoS Protection

<details>
<summary>Click to view code (python)</summary>

```python
# Implement connection limits
from flask import Flask, request
from collections import defaultdict
import time

class DDoSProtection:
    def __init__(self):
        self.connections = defaultdict(list)
        self.max_connections = 10  # Per IP
        self.window = 60  # seconds
    
    def is_allowed(self, ip: str) -> bool:
        """Check if IP is allowed to connect"""
        now = time.time()
        window_start = now - self.window
        
        # Clean old connections
        self.connections[ip] = [
            t for t in self.connections[ip]
            if t > window_start
        ]
        
        # Check limit
        if len(self.connections[ip]) >= self.max_connections:
            return False
        
        self.connections[ip].append(now)
        return True

# Use CDN (Cloudflare, AWS CloudFront) for DDoS protection
# Configure at infrastructure level
```

</details>

**DDoS Protection Best Practices:**
- Use CDN with DDoS protection
- Implement rate limiting
- Use AWS Shield / Cloudflare
- Monitor traffic patterns
- Implement CAPTCHA for suspicious traffic
- Use geo-blocking if applicable
- Set connection limits
- Use load balancers

---

### 2. Firewall Rules

<details>
<summary>Click to view code (python)</summary>

```python
# Configure security groups (AWS example)
# Allow only necessary ports
security_group_rules = [
    {
        'IpProtocol': 'tcp',
        'FromPort': 443,
        'ToPort': 443,
        'IpRanges': [{'CidrIp': '0.0.0.0/0'}]  # HTTPS
    },
    {
        'IpProtocol': 'tcp',
        'FromPort': 22,
        'ToPort': 22,
        'IpRanges': [{'CidrIp': '10.0.0.0/8'}]  # SSH from private network only
    },
    {
        'IpProtocol': 'tcp',
        'FromPort': 5432,
        'ToPort': 5432,
        'IpRanges': [{'CidrIp': '10.0.1.0/24'}]  # PostgreSQL from app servers only
    }
]
```

</details>

---

## Application Security

### 1. XSS (Cross-Site Scripting) Prevention

<details>
<summary>Click to view code (python)</summary>

```python
from html import escape
from markupsafe import Markup

class XSSPrevention:
    @staticmethod
    def sanitize_html(text: str) -> str:
        """Escape HTML to prevent XSS"""
        return escape(text)
    
    @staticmethod
    def sanitize_for_javascript(text: str) -> str:
        """Escape for JavaScript context"""
        # Escape dangerous characters
        replacements = {
            '<': '\\u003C',
            '>': '\\u003E',
            '&': '\\u0026',
            '"': '\\u0022',
            "'": '\\u0027',
            '/': '\\u002F'
        }
        for char, replacement in replacements.items():
            text = text.replace(char, replacement)
        return text

# Use templating engines that auto-escape
# Jinja2 (Flask)
from flask import render_template

@app.route('/profile')
def profile():
    user_input = request.args.get('name', '')
    # Jinja2 automatically escapes {{ name }}
    return render_template('profile.html', name=user_input)

# Content Security Policy
@app.after_request
def set_csp(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://trusted-cdn.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://api.example.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    return response
```

</details>

---

### 2. CSRF (Cross-Site Request Forgery) Prevention

<details>
<summary>Click to view code (python)</summary>

```python
from flask_wtf.csrf import CSRFProtect
import secrets

csrf = CSRFProtect(app)

# Generate CSRF token
def generate_csrf_token():
    if '_csrf_token' not in session:
        session['_csrf_token'] = secrets.token_hex(32)
    return session['_csrf_token']

# Verify CSRF token
def verify_csrf_token(token):
    return token == session.get('_csrf_token')

# Include in forms
# <form method="POST">
#   <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
# </form>

# For AJAX requests
# Add X-CSRF-Token header
```

</details>

---

### 3. Secure Session Management

<details>
<summary>Click to view code (python)</summary>

```python
from flask import Flask, session
from datetime import timedelta

app = Flask(__name__)

# Secure session configuration
app.config.update(
    SECRET_KEY=os.environ['SECRET_KEY'],  # Strong random key
    SESSION_COOKIE_SECURE=True,            # HTTPS only
    SESSION_COOKIE_HTTPONLY=True,          # No JavaScript access
    SESSION_COOKIE_SAMESITE='Lax',         # CSRF protection
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),  # Session timeout
    SESSION_REFRESH_EACH_REQUEST=True      # Extend on activity
)

@app.route('/login', methods=['POST'])
def login():
    # After successful authentication
    session.permanent = True
    session['user_id'] = user.id
    session['login_time'] = time.time()
    
    # Regenerate session ID
    session.modified = True

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

# Session validation middleware
@app.before_request
def validate_session():
    if 'user_id' in session:
        # Check session age
        login_time = session.get('login_time', 0)
        if time.time() - login_time > 3600:  # 1 hour max
            session.clear()
            return redirect('/login')
```

</details>

---

## Infrastructure Security

### 1. Container Security

<details>
<summary>Click to view code (yaml)</summary>

```yaml
# Dockerfile best practices
FROM python:3.11-slim AS base

# Don't run as root
RUN useradd -m -u 1000 appuser

# Copy only necessary files
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser . /app
WORKDIR /app

# Switch to non-root user
USER appuser

# Use specific versions
# Don't use :latest

# Scan for vulnerabilities
# docker scan myimage:tag

# Limit resources
# docker run --memory=512m --cpus=0.5 myimage
```

</details>

---

### 2. Secrets Management

<details>
<summary>Click to view code (python)</summary>

```python
import os
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential

class SecretsManager:
    def __init__(self):
        # Use environment variable for vault URL
        vault_url = os.environ['KEY_VAULT_URL']
        credential = DefaultAzureCredential()
        self.client = SecretClient(vault_url=vault_url, credential=credential)
    
    def get_secret(self, name: str) -> str:
        """Retrieve secret from Key Vault"""
        secret = self.client.get_secret(name)
        return secret.value
    
    def set_secret(self, name: str, value: str):
        """Store secret in Key Vault"""
        self.client.set_secret(name, value)

# Usage
secrets = SecretsManager()
db_password = secrets.get_secret('database-password')
api_key = secrets.get_secret('external-api-key')

# NEVER hardcode secrets
# BAD
db_password = "hardcoded_password"

# GOOD
db_password = os.environ['DB_PASSWORD']
```

</details>

---

### 3. Logging & Monitoring

<details>
<summary>Click to view code (python)</summary>

```python
import logging
import json
from datetime import datetime

# Security event logging
class SecurityLogger:
    def __init__(self):
        self.logger = logging.getLogger('security')
        handler = logging.FileHandler('security.log')
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
    
    def log_authentication(
        self,
        user_id: str,
        success: bool,
        ip: str,
        user_agent: str
    ):
        """Log authentication attempt"""
        event = {
            'event_type': 'authentication',
            'user_id': user_id,
            'success': success,
            'ip': ip,
            'user_agent': user_agent,
            'timestamp': datetime.utcnow().isoformat()
        }
        self.logger.info(json.dumps(event))
    
    def log_authorization(
        self,
        user_id: str,
        resource: str,
        action: str,
        granted: bool
    ):
        """Log authorization decision"""
        event = {
            'event_type': 'authorization',
            'user_id': user_id,
            'resource': resource,
            'action': action,
            'granted': granted,
            'timestamp': datetime.utcnow().isoformat()
        }
        self.logger.info(json.dumps(event))
    
    def log_suspicious_activity(
        self,
        user_id: str,
        activity: str,
        details: dict
    ):
        """Log suspicious activity"""
        event = {
            'event_type': 'suspicious_activity',
            'user_id': user_id,
            'activity': activity,
            'details': details,
            'timestamp': datetime.utcnow().isoformat()
        }
        self.logger.warning(json.dumps(event))

# Usage
security_logger = SecurityLogger()

@app.route('/login', methods=['POST'])
def login():
    user = authenticate(request.form['email'], request.form['password'])
    
    security_logger.log_authentication(
        user_id=request.form['email'],
        success=user is not None,
        ip=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    )
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    return jsonify({'token': create_token(user)})
```

</details>

**Logging Best Practices:**
- Log all authentication events
- Log authorization failures
- Log sensitive data access
- Don't log sensitive data (passwords, tokens)
- Use structured logging (JSON)
- Implement log aggregation (ELK, Splunk)
- Set up alerts for suspicious patterns
- Retain logs for compliance

---

## Compliance & Privacy

### 1. GDPR Compliance

<details>
<summary>Click to view code (python)</summary>

```python
class GDPRCompliance:
    def anonymize_user(self, user_id: str):
        """Anonymize user data (GDPR Right to be Forgotten)"""
        user = db.get_user(user_id)
        
        # Replace with anonymous data
        user.email = f"deleted_{user_id}@example.com"
        user.name = "Deleted User"
        user.phone = None
        user.address = None
        user.is_deleted = True
        
        db.save(user)
    
    def export_user_data(self, user_id: str) -> dict:
        """Export all user data (GDPR Right to Data Portability)"""
        user = db.get_user(user_id)
        posts = db.get_user_posts(user_id)
        comments = db.get_user_comments(user_id)
        
        return {
            'personal_info': {
                'email': user.email,
                'name': user.name,
                'phone': user.phone,
                'address': user.address
            },
            'posts': [post.to_dict() for post in posts],
            'comments': [comment.to_dict() for comment in comments],
            'created_at': user.created_at.isoformat()
        }
    
    def get_consent(self, user_id: str, purpose: str) -> bool:
        """Check user consent for data processing"""
        consent = db.get_consent(user_id, purpose)
        return consent and consent.is_active
    
    def record_consent(
        self,
        user_id: str,
        purpose: str,
        granted: bool
    ):
        """Record user consent"""
        db.create_consent_record({
            'user_id': user_id,
            'purpose': purpose,
            'granted': granted,
            'timestamp': datetime.utcnow()
        })
```

</details>

---

### 2. PCI DSS Compliance (Payment Card Industry)

<details>
<summary>Click to view code (python)</summary>

```python
class PCICompliance:
    def tokenize_card(self, card_number: str) -> str:
        """Tokenize credit card (never store full card number)"""
        # Use payment processor's tokenization (Stripe, PayPal)
        token = payment_processor.tokenize(card_number)
        return token
    
    def validate_card(self, card_number: str) -> bool:
        """Validate card using Luhn algorithm"""
        def luhn_checksum(card_number):
            def digits_of(n):
                return [int(d) for d in str(n)]
            
            digits = digits_of(card_number)
            odd_digits = digits[-1::-2]
            even_digits = digits[-2::-2]
            checksum = sum(odd_digits)
            for d in even_digits:
                checksum += sum(digits_of(d * 2))
            return checksum % 10
        
        return luhn_checksum(card_number) == 0
```

</details>

---

## Interview Questions & Answers

### Q1: How would you implement authentication and authorization for a microservices architecture with 50+ services?

**Answer:**

**Challenge:**
- 50+ microservices
- Each service needs to authenticate users
- Need centralized user management
- Services need to authorize actions
- Must be scalable and secure

**Solution: OAuth 2.0 + JWT + API Gateway Pattern**

**Architecture:**

<details>
<summary>Click to view code</summary>

```
Client → API Gateway → Auth Service (OAuth 2.0)
                    ↓
                  JWT Token
                    ↓
         Microservices (JWT validation)
```

</details>

**Implementation:**

<details>
<summary>Click to view code (python)</summary>

```python
# 1. Centralized Auth Service
from authlib.integrations.flask_oauth2 import AuthorizationServer
from authlib.oauth2.rfc6749 import grants

class AuthService:
    def __init__(self):
        self.server = AuthorizationServer()
        self.jwt_service = JWTService(secret_key=os.environ['JWT_SECRET'])
    
    def authenticate(self, email: str, password: str) -> dict:
        """Authenticate user and return tokens"""
        user = db.get_user_by_email(email)
        
        if not user or not bcrypt.checkpw(password, user.password_hash):
            raise Exception("Invalid credentials")
        
        # Generate tokens
        access_token = self.jwt_service.create_access_token(
            user_id=user.id,
            additional_claims={
                'email': user.email,
                'role': user.role,
                'permissions': user.permissions
            }
        )
        
        refresh_token = self.jwt_service.create_refresh_token(user.id)
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': 'Bearer',
            'expires_in': 900  # 15 minutes
        }

# 2. API Gateway - Token Validation
from fastapi import FastAPI, HTTPException, Depends, Header
import httpx

app = FastAPI()

async def verify_token(authorization: str = Header(None)) -> dict:
    """Verify JWT token from Authorization header"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing token")
    
    token = authorization.split(' ')[1]
    
    try:
        # Verify token
        jwt_service = JWTService(secret_key=os.environ['JWT_SECRET'])
        payload = jwt_service.verify_token(token)
        
        # Check if token is blacklisted
        if await redis_client.exists(f"blacklist:{token}"):
            raise HTTPException(status_code=401, detail="Token revoked")
        
        return payload
    
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# 3. Microservice - JWT validation
class UserService:
    @app.get("/api/users/{user_id}")
    async def get_user(
        user_id: str,
        token_payload: dict = Depends(verify_token)
    ):
        """Protected endpoint"""
        # Extract user info from token
        requesting_user = token_payload['sub']
        role = token_payload.get('role')
        
        # Authorization check
        if requesting_user != user_id and role != 'admin':
            raise HTTPException(status_code=403, detail="Forbidden")
        
        user = db.get_user(user_id)
        return user

# 4. Service-to-Service Authentication (mTLS)
import ssl
import httpx

class ServiceClient:
    def __init__(self):
        # Load service certificates
        self.ssl_context = ssl.create_default_context(
            ssl.Purpose.CLIENT_AUTH
        )
        self.ssl_context.load_cert_chain(
            certfile='service-cert.pem',
            keyfile='service-key.pem'
        )
    
    async def call_service(self, url: str):
        """Make authenticated request to another service"""
        async with httpx.AsyncClient(verify=self.ssl_context) as client:
            response = await client.get(url)
            return response.json()
```

</details>

**Key Components:**

1. **Centralized Auth Service:**
   - Single source of truth for authentication
   - Issues JWT tokens
   - Manages user credentials
   - Handles token refresh

2. **API Gateway:**
   - Single entry point
   - Validates JWT tokens
   - Routes requests to services
   - Rate limiting

3. **Microservices:**
   - Validate JWT tokens locally (no round-trip to auth service)
   - Extract user info from token
   - Implement authorization logic
   - Use mTLS for service-to-service

4. **Token Strategy:**
   - Access token: 15 min expiry
   - Refresh token: 7 days expiry
   - Store refresh tokens in database
   - Implement token blacklist for logout

**Benefits:**
- Scalable (no auth service bottleneck)
- Secure (JWT signature verification)
- Fast (no database lookup per request)
- Centralized user management
- Service-to-service security with mTLS

---

### Q2: Design a rate limiting system that prevents API abuse while allowing legitimate burst traffic.

**Answer:**

**Requirements:**
- Prevent abuse (DDoS, scraping)
- Allow legitimate bursts (user uploads 10 photos)
- Fair for all users
- Distributed (multiple servers)
- Different limits per plan (free, premium, enterprise)

**Solution: Token Bucket Algorithm with Redis**

**How Token Bucket Works:**
<details>
<summary>Click to view code</summary>

```
Bucket capacity: 100 tokens
Refill rate: 10 tokens/second

User makes request:
- Check if bucket has ≥1 token
- If yes: Remove 1 token, allow request
- If no: Reject request (429 Too Many Requests)

Tokens refill over time up to capacity
Allows bursts up to bucket capacity
```

</details>

**Implementation:**

<details>
<summary>Click to view code (python)</summary>

```python
import redis
import time
from typing import Tuple

class TokenBucketRateLimiter:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        
        # Rate limit tiers
        self.rate_limits = {
            'free': {
                'capacity': 100,        # Max burst
                'refill_rate': 10,      # Tokens per second
                'cost': 1               # Cost per request
            },
            'premium': {
                'capacity': 1000,
                'refill_rate': 100,
                'cost': 1
            },
            'enterprise': {
                'capacity': 10000,
                'refill_rate': 1000,
                'cost': 1
            }
        }
    
    def is_allowed(
        self,
        user_id: str,
        tier: str = 'free',
        cost: int = 1
    ) -> Tuple[bool, dict]:
        """
        Check if request is allowed using token bucket algorithm
        
        Returns: (allowed, info_dict)
        """
        config = self.rate_limits[tier]
        capacity = config['capacity']
        refill_rate = config['refill_rate']
        
        key = f"rate_limit:{tier}:{user_id}"
        now = time.time()
        
        # Lua script for atomic operation
        lua_script = """
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local cost = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])
        
        -- Get current bucket state
        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1])
        local last_refill = tonumber(bucket[2])
        
        -- Initialize if doesn't exist
        if tokens == nil then
            tokens = capacity
            last_refill = now
        end
        
        -- Calculate tokens to add
        local time_passed = now - last_refill
        local tokens_to_add = time_passed * refill_rate
        tokens = math.min(capacity, tokens + tokens_to_add)
        
        -- Check if enough tokens
        if tokens >= cost then
            tokens = tokens - cost
            
            -- Update bucket
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
            redis.call('EXPIRE', key, 3600)  -- 1 hour expiry
            
            return {1, tokens}  -- Allowed
        else
            return {0, tokens}  -- Denied
        end
        """
        
        # Execute Lua script
        result = self.redis.eval(
            lua_script,
            1,  # Number of keys
            key,
            capacity,
            refill_rate,
            cost,
            now
        )
        
        allowed = bool(result[0])
        remaining_tokens = result[1]
        
        # Calculate retry after
        retry_after = 0
        if not allowed:
            retry_after = int((cost - remaining_tokens) / refill_rate)
        
        return allowed, {
            'capacity': capacity,
            'remaining': int(remaining_tokens),
            'refill_rate': refill_rate,
            'retry_after': retry_after
        }

# Usage with Flask
from flask import Flask, request, jsonify, g

app = Flask(__name__)
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
rate_limiter = TokenBucketRateLimiter(redis_client)

def get_user_tier(user_id: str) -> str:
    """Get user's subscription tier"""
    user = db.get_user(user_id)
    return user.subscription_tier if user else 'free'

@app.before_request
def rate_limit_middleware():
    """Apply rate limiting to all requests"""
    # Extract user ID from token
    user_id = extract_user_id_from_token(request.headers.get('Authorization'))
    
    if not user_id:
        user_id = request.remote_addr  # Use IP for anonymous
    
    # Get user tier
    tier = get_user_tier(user_id)
    
    # Check rate limit
    allowed, info = rate_limiter.is_allowed(user_id, tier)
    
    # Store info for response headers
    g.rate_limit_info = info
    
    if not allowed:
        response = jsonify({
            'error': 'Rate limit exceeded',
            'retry_after': info['retry_after']
        })
        response.status_code = 429
        response.headers['Retry-After'] = str(info['retry_after'])
        response.headers['X-RateLimit-Limit'] = str(info['capacity'])
        response.headers['X-RateLimit-Remaining'] = '0'
        return response

@app.after_request
def add_rate_limit_headers(response):
    """Add rate limit headers"""
    if hasattr(g, 'rate_limit_info'):
        info = g.rate_limit_info
        response.headers['X-RateLimit-Limit'] = str(info['capacity'])
        response.headers['X-RateLimit-Remaining'] = str(info['remaining'])
        response.headers['X-RateLimit-Reset'] = str(
            int(time.time() + (info['capacity'] - info['remaining']) / info['refill_rate'])
        )
    return response

# Different costs for different endpoints
@app.route('/api/light-operation')
def light_operation():
    # Normal cost (1 token)
    return jsonify({'data': 'result'})

@app.route('/api/heavy-operation')
def heavy_operation():
    # Higher cost for expensive operations
    user_id = g.user_id
    tier = get_user_tier(user_id)
    
    # Check with higher cost
    allowed, info = rate_limiter.is_allowed(user_id, tier, cost=10)
    
    if not allowed:
        return jsonify({'error': 'Rate limit exceeded'}), 429
    
    # Perform expensive operation
    result = expensive_computation()
    return jsonify({'data': result})
```

</details>

**Advanced Features:**

<details>
<summary>Click to view code (python)</summary>

```python
# 1. Sliding Window Log (more accurate)
class SlidingWindowRateLimiter:
    def is_allowed(self, user_id: str, max_requests: int, window: int):
        """
        Track individual request timestamps
        More accurate but uses more memory
        """
        key = f"sliding:{user_id}"
        now = time.time()
        window_start = now - window
        
        # Remove old requests
        self.redis.zremrangebyscore(key, 0, window_start)
        
        # Count requests in window
        count = self.redis.zcard(key)
        
        if count < max_requests:
            # Add current request
            self.redis.zadd(key, {str(now): now})
            self.redis.expire(key, window)
            return True
        
        return False

# 2. Distributed Rate Limiting with Multiple Nodes
class DistributedRateLimiter:
    def __init__(self, redis_cluster):
        self.redis = redis_cluster
        # Use consistent hashing to distribute load
    
    def is_allowed(self, user_id: str):
        # Rate limit check happens on Redis
        # Multiple API servers share same Redis cluster
        # Atomic operations ensure accuracy
        pass

# 3. Adaptive Rate Limiting
class AdaptiveRateLimiter:
    def adjust_rate_limit(self, user_id: str):
        """Adjust rate limit based on behavior"""
        # Increase limit for good users
        # Decrease for suspicious behavior
        
        user_score = self.calculate_trust_score(user_id)
        
        if user_score > 0.8:  # Trusted user
            multiplier = 2.0
        elif user_score < 0.3:  # Suspicious
            multiplier = 0.5
        else:
            multiplier = 1.0
        
        return multiplier
```

</details>

**Best Practices:**
1. Use token bucket for burst traffic
2. Different limits per tier
3. Higher costs for expensive operations
4. Return proper headers (X-RateLimit-*)
5. Return 429 with Retry-After
6. Use Redis for distributed system
7. Monitor rate limit hits
8. Allow bursts for legitimate use

---

### Q3: How would you secure API keys and prevent them from being compromised?

**Answer:**

**Challenge:**
- API keys can be leaked (GitHub, client-side code)
- Keys can be stolen (MITM, XSS)
- Need to detect compromised keys
- Need to limit blast radius

**Solution: Multi-Layered API Key Security**

**1. Key Generation & Storage:**

<details>
<summary>Click to view code (python)</summary>

```python
import secrets
import hashlib
from datetime import datetime, timedelta

class SecureAPIKeyManager:
    def generate_key(self, user_id: str, name: str) -> dict:
        """Generate API key with multiple components"""
        # Key structure: prefix_publicpart_secretpart
        prefix = "sk"  # Indicates secret key
        public_part = secrets.token_urlsafe(8)   # Identifies key
        secret_part = secrets.token_urlsafe(32)  # Secret component
        
        api_key = f"{prefix}_{public_part}_{secret_part}"
        
        # Store only hash of secret part
        secret_hash = hashlib.sha256(secret_part.encode()).hexdigest()
        
        # Create key record
        key_record = {
            'id': public_part,
            'user_id': user_id,
            'name': name,
            'secret_hash': secret_hash,
            'created_at': datetime.utcnow(),
            'last_used': None,
            'is_active': True,
            
            # Security features
            'allowed_ips': [],          # IP whitelist
            'allowed_origins': [],      # Origin whitelist
            'scopes': [],               # Permissions
            'rate_limit': 1000,         # Per hour
            'expires_at': None,         # Optional expiration
            
            # Monitoring
            'total_requests': 0,
            'failed_attempts': 0,
            'last_failure': None
        }
        
        db.save_key(key_record)
        
        return {
            'api_key': api_key,  # Show only once
            'key_id': public_part,
            'message': 'Save this key securely. It cannot be recovered.'
        }
    
    def verify_key(self, api_key: str, request_info: dict) -> bool:
        """Verify API key with security checks"""
        try:
            # Parse key
            parts = api_key.split('_')
            if len(parts) != 3 or parts[0] != 'sk':
                return False
            
            prefix, public_part, secret_part = parts
            
            # Get key record
            key_record = db.get_key_by_id(public_part)
            if not key_record or not key_record['is_active']:
                return False
            
            # Verify secret part
            secret_hash = hashlib.sha256(secret_part.encode()).hexdigest()
            if not secrets.compare_digest(secret_hash, key_record['secret_hash']):
                self.log_failed_attempt(public_part, request_info)
                return False
            
            # Check expiration
            if key_record['expires_at']:
                if datetime.utcnow() > key_record['expires_at']:
                    return False
            
            # Check IP whitelist
            if key_record['allowed_ips']:
                if request_info['ip'] not in key_record['allowed_ips']:
                    self.log_suspicious_activity(
                        public_part,
                        f"Request from unauthorized IP: {request_info['ip']}"
                    )
                    return False
            
            # Check origin whitelist
            if key_record['allowed_origins']:
                if request_info.get('origin') not in key_record['allowed_origins']:
                    return False
            
            # Update usage
            self.update_key_usage(public_part)
            
            return True
        
        except Exception as e:
            logging.error(f"Key verification error: {e}")
            return False
    
    def log_failed_attempt(self, key_id: str, request_info: dict):
        """Log failed authentication attempt"""
        key_record = db.get_key_by_id(key_id)
        key_record['failed_attempts'] += 1
        key_record['last_failure'] = datetime.utcnow()
        
        # Auto-revoke after too many failures
        if key_record['failed_attempts'] >= 5:
            key_record['is_active'] = False
            self.send_alert(key_record['user_id'], "API key auto-revoked due to failed attempts")
        
        db.save_key(key_record)
    
    def rotate_key(self, old_key_id: str) -> dict:
        """Rotate API key (maintain old key for grace period)"""
        old_record = db.get_key_by_id(old_key_id)
        
        # Generate new key
        new_key_data = self.generate_key(
            old_record['user_id'],
            old_record['name'] + ' (rotated)'
        )
        
        # Mark old key for deprecation
        old_record['deprecated_at'] = datetime.utcnow()
        old_record['grace_period_end'] = datetime.utcnow() + timedelta(days=30)
        db.save_key(old_record)
        
        return new_key_data
```

</details>

**2. Key Restrictions:**

<details>
<summary>Click to view code (python)</summary>

```python
class APIKeyRestrictions:
    def check_ip_whitelist(self, key: dict, ip: str) -> bool:
        """Only allow from specific IPs"""
        if not key['allowed_ips']:
            return True  # No restriction
        return ip in key['allowed_ips']
    
    def check_origin_whitelist(self, key: dict, origin: str) -> bool:
        """Only allow from specific origins (for browser requests)"""
        if not key['allowed_origins']:
            return True
        return origin in key['allowed_origins']
    
    def check_scopes(self, key: dict, required_scope: str) -> bool:
        """Check if key has required permission"""
        if not key['scopes']:
            return False  # Deny by default
        return required_scope in key['scopes']
    
    def check_time_window(self, key: dict) -> bool:
        """Only allow during specific hours"""
        if 'allowed_hours' not in key:
            return True
        
        current_hour = datetime.utcnow().hour
        return current_hour in key['allowed_hours']

# Apply restrictions
@app.before_request
def validate_api_key():
    api_key = request.headers.get('X-API-Key')
    
    if not api_key:
        return jsonify({'error': 'API key required'}), 401
    
    key_manager = SecureAPIKeyManager()
    restrictions = APIKeyRestrictions()
    
    # Verify key
    request_info = {
        'ip': request.remote_addr,
        'origin': request.headers.get('Origin'),
        'user_agent': request.headers.get('User-Agent')
    }
    
    if not key_manager.verify_key(api_key, request_info):
        return jsonify({'error': 'Invalid API key'}), 401
    
    # Get key record
    key_id = api_key.split('_')[1]
    key_record = db.get_key_by_id(key_id)
    
    # Apply restrictions
    if not restrictions.check_ip_whitelist(key_record, request.remote_addr):
        return jsonify({'error': 'IP not allowed'}), 403
    
    if not restrictions.check_origin_whitelist(
        key_record,
        request.headers.get('Origin')
    ):
        return jsonify({'error': 'Origin not allowed'}), 403
    
    # Store for later use
    g.api_key = key_record
```

</details>

**3. Anomaly Detection:**

<details>
<summary>Click to view code (python)</summary>

```python
class APIKeyAnomalyDetector:
    def detect_anomalies(self, key_id: str, request_info: dict) -> list:
        """Detect suspicious patterns"""
        anomalies = []
        key_record = db.get_key_by_id(key_id)
        
        # 1. Unusual location
        recent_locations = self.get_recent_locations(key_id)
        if request_info['ip'] not in recent_locations:
            geo_distance = self.calculate_distance(
                self.get_location(recent_locations[0]),
                self.get_location(request_info['ip'])
            )
            
            if geo_distance > 1000:  # km
                anomalies.append({
                    'type': 'unusual_location',
                    'severity': 'high',
                    'details': f'Request from {geo_distance}km away'
                })
        
        # 2. Unusual traffic pattern
        request_rate = self.get_request_rate(key_id, window=60)  # Last minute
        avg_rate = key_record.get('avg_request_rate', 10)
        
        if request_rate > avg_rate * 10:
            anomalies.append({
                'type': 'unusual_traffic',
                'severity': 'medium',
                'details': f'Request rate {request_rate}/min vs avg {avg_rate}/min'
            })
        
        # 3. Unusual endpoint access
        endpoint = request_info['endpoint']
        recent_endpoints = self.get_recent_endpoints(key_id)
        
        if endpoint not in recent_endpoints:
            anomalies.append({
                'type': 'new_endpoint',
                'severity': 'low',
                'details': f'First access to {endpoint}'
            })
        
        # 4. Unusual time
        hour = datetime.utcnow().hour
        active_hours = key_record.get('typical_active_hours', [])
        
        if active_hours and hour not in active_hours:
            anomalies.append({
                'type': 'unusual_time',
                'severity': 'low',
                'details': f'Request at unusual hour: {hour}'
            })
        
        # Take action based on severity
        if any(a['severity'] == 'high' for a in anomalies):
            self.auto_revoke_key(key_id)
            self.send_alert(key_record['user_id'], anomalies)
        
        return anomalies
```

</details>

**4. Key Leak Detection:**

<details>
<summary>Click to view code (python)</summary>

```python
class APIKeyLeakDetector:
    def scan_github(self, pattern: str):
        """Scan GitHub for leaked keys"""
        # Use GitHub API to search for pattern
        # sk_[a-zA-Z0-9_-]{40,}
        pass
    
    def scan_pastebin(self, pattern: str):
        """Scan Pastebin for leaked keys"""
        pass
    
    def handle_leaked_key(self, key_id: str):
        """Handle detected leaked key"""
        # 1. Immediately revoke
        key_record = db.get_key_by_id(key_id)
        key_record['is_active'] = False
        key_record['revoked_reason'] = 'Leaked online'
        db.save_key(key_record)
        
        # 2. Alert user
        self.send_alert(
            key_record['user_id'],
            f"API key '{key_record['name']}' was found leaked online and has been revoked"
        )
        
        # 3. Log incident
        security_logger.log_security_incident({
            'type': 'key_leak',
            'key_id': key_id,
            'user_id': key_record['user_id']
        })
```

</details>

**Best Practices Summary:**
1. **Key Format**: Use prefixes and structure (sk_public_secret)
2. **Storage**: Store only hashes, never plaintext
3. **Restrictions**: IP whitelist, origin whitelist, scopes
4. **Monitoring**: Track usage patterns, detect anomalies
5. **Rotation**: Regular key rotation, grace periods
6. **Expiration**: Set expiration dates
7. **Rate Limiting**: Per-key rate limits
8. **Revocation**: Easy revocation process
9. **Leak Detection**: Automated scanning
10. **Alerts**: Notify users of suspicious activity

---

### Q4: Design end-to-end encryption for a chat application. How do you handle key management?

**Answer:**

**Requirements:**
- End-to-end encryption (server can't read messages)
- Forward secrecy (past messages safe even if key compromised)
- Multi-device support
- Group chats
- Secure key exchange

**Solution: Signal Protocol (Double Ratchet Algorithm)**

**Architecture:**

<details>
<summary>Click to view code (python)</summary>

```python
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import x25519
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import os

class SignalProtocol:
    def __init__(self):
        self.identity_key = self.generate_identity_key()
        self.signed_pre_key = self.generate_pre_key()
        self.one_time_pre_keys = [self.generate_pre_key() for _ in range(100)]
    
    def generate_identity_key(self) -> x25519.X25519PrivateKey:
        """Generate long-term identity key"""
        return x25519.X25519PrivateKey.generate()
    
    def generate_pre_key(self) -> x25519.X25519PrivateKey:
        """Generate pre-key for key exchange"""
        return x25519.X25519PrivateKey.generate()
    
    def register_user(self, user_id: str):
        """Register user and upload public keys to server"""
        identity_public_key = self.identity_key.public_key()
        signed_pre_key_public = self.signed_pre_key.public_key()
        one_time_pre_keys_public = [
            key.public_key() for key in self.one_time_pre_keys
        ]
        
        # Upload to server
        server_db.store_user_keys({
            'user_id': user_id,
            'identity_key': self.serialize_public_key(identity_public_key),
            'signed_pre_key': self.serialize_public_key(signed_pre_key_public),
            'one_time_pre_keys': [
                self.serialize_public_key(k) for k in one_time_pre_keys_public
            ]
        })
    
    def initiate_session(self, sender_id: str, recipient_id: str):
        """Initiate encrypted session (X3DH key exchange)"""
        # 1. Fetch recipient's public keys from server
        recipient_keys = server_db.get_user_keys(recipient_id)
        
        recipient_identity_key = self.deserialize_public_key(
            recipient_keys['identity_key']
        )
        recipient_signed_pre_key = self.deserialize_public_key(
            recipient_keys['signed_pre_key']
        )
        recipient_one_time_pre_key = self.deserialize_public_key(
            recipient_keys['one_time_pre_keys'][0]
        )
        
        # 2. Generate ephemeral key
        ephemeral_key = x25519.X25519PrivateKey.generate()
        
        # 3. Perform Diffie-Hellman exchanges
        dh1 = self.identity_key.exchange(recipient_signed_pre_key)
        dh2 = ephemeral_key.exchange(recipient_identity_key)
        dh3 = ephemeral_key.exchange(recipient_signed_pre_key)
        dh4 = ephemeral_key.exchange(recipient_one_time_pre_key)
        
        # 4. Derive shared secret
        shared_secret = dh1 + dh2 + dh3 + dh4
        
        # 5. Derive root key and chain key
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=64,
            salt=None,
            info=b'Signal'
        )
        key_material = hkdf.derive(shared_secret)
        
        root_key = key_material[:32]
        chain_key = key_material[32:]
        
        # Store session
        session = {
            'recipient_id': recipient_id,
            'root_key': root_key,
            'sending_chain_key': chain_key,
            'receiving_chain_key': None,
            'message_number': 0
        }
        
        return session
    
    def encrypt_message(
        self,
        session: dict,
        plaintext: str
    ) -> dict:
        """Encrypt message using Double Ratchet"""
        # 1. Derive message key from chain key
        message_key = self.derive_message_key(
            session['sending_chain_key'],
            session['message_number']
        )
        
        # 2. Encrypt message with AES-GCM
        iv = os.urandom(12)
        cipher = Cipher(
            algorithms.AES(message_key),
            modes.GCM(iv)
        )
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(plaintext.encode()) + encryptor.finalize()
        
        # 3. Advance chain key (forward secrecy)
        session['sending_chain_key'] = self.advance_chain_key(
            session['sending_chain_key']
        )
        session['message_number'] += 1
        
        return {
            'ciphertext': ciphertext,
            'iv': iv,
            'tag': encryptor.tag,
            'message_number': session['message_number'] - 1
        }
    
    def decrypt_message(
        self,
        session: dict,
        encrypted_message: dict
    ) -> str:
        """Decrypt message"""
        # 1. Derive message key
        message_key = self.derive_message_key(
            session['receiving_chain_key'],
            encrypted_message['message_number']
        )
        
        # 2. Decrypt with AES-GCM
        cipher = Cipher(
            algorithms.AES(message_key),
            modes.GCM(encrypted_message['iv'], encrypted_message['tag'])
        )
        decryptor = cipher.decryptor()
        plaintext = decryptor.update(encrypted_message['ciphertext']) + decryptor.finalize()
        
        # 3. Advance chain key
        session['receiving_chain_key'] = self.advance_chain_key(
            session['receiving_chain_key']
        )
        
        return plaintext.decode()
    
    def derive_message_key(self, chain_key: bytes, message_num: int) -> bytes:
        """Derive message key from chain key"""
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=f'message_{message_num}'.encode()
        )
        return hkdf.derive(chain_key)
    
    def advance_chain_key(self, chain_key: bytes) -> bytes:
        """Advance chain key (ratchet forward)"""
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b'chain_key'
        )
        return hkdf.derive(chain_key)
    
    def serialize_public_key(self, public_key) -> str:
        """Serialize public key for transmission"""
        return public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        ).hex()
    
    def deserialize_public_key(self, key_hex: str):
        """Deserialize public key"""
        key_bytes = bytes.fromhex(key_hex)
        return x25519.X25519PublicKey.from_public_bytes(key_bytes)
```

</details>

**Multi-Device Support:**

<details>
<summary>Click to view code (python)</summary>

```python
class MultiDeviceManager:
    def register_device(self, user_id: str, device_id: str):
        """Register new device for user"""
        protocol = SignalProtocol()
        protocol.register_user(f"{user_id}:{device_id}")
        
        # Store device keys
        db.add_device({
            'user_id': user_id,
            'device_id': device_id,
            'identity_key': protocol.identity_key,
            'registered_at': datetime.utcnow()
        })
    
    def send_message_to_user(
        self,
        sender_id: str,
        recipient_id: str,
        message: str
    ):
        """Send message to all recipient devices"""
        # Get all recipient devices
        devices = db.get_user_devices(recipient_id)
        
        encrypted_messages = []
        for device in devices:
            # Create session with each device
            device_full_id = f"{recipient_id}:{device['device_id']}"
            session = protocol.initiate_session(sender_id, device_full_id)
            
            # Encrypt message for this device
            encrypted = protocol.encrypt_message(session, message)
            encrypted_messages.append({
                'device_id': device['device_id'],
                'encrypted_message': encrypted
            })
        
        # Send to server for delivery
        server_db.store_messages(recipient_id, encrypted_messages)
```

</details>

**Group Chat Encryption:**

<details>
<summary>Click to view code (python)</summary>

```python
class GroupChatEncryption:
    def create_group(self, creator_id: str, member_ids: list) -> str:
        """Create encrypted group chat"""
        group_id = secrets.token_hex(16)
        
        # Generate group symmetric key
        group_key = os.urandom(32)
        
        # Encrypt group key for each member
        encrypted_keys = {}
        for member_id in member_ids:
            # Get member's public key
            member_keys = server_db.get_user_keys(member_id)
            
            # Encrypt group key with member's public key
            # (simplified - use proper hybrid encryption)
            encrypted_key = self.encrypt_for_user(group_key, member_keys)
            encrypted_keys[member_id] = encrypted_key
        
        # Store group info
        db.create_group({
            'group_id': group_id,
            'creator_id': creator_id,
            'member_ids': member_ids,
            'encrypted_keys': encrypted_keys,
            'created_at': datetime.utcnow()
        })
        
        return group_id
    
    def send_group_message(
        self,
        sender_id: str,
        group_id: str,
        message: str
    ):
        """Send message to group"""
        # Get group key (encrypted for sender)
        group = db.get_group(group_id)
        group_key_encrypted = group['encrypted_keys'][sender_id]
        
        # Decrypt group key
        group_key = self.decrypt_group_key(group_key_encrypted, sender_id)
        
        # Encrypt message with group key
        iv = os.urandom(12)
        cipher = Cipher(
            algorithms.AES(group_key),
            modes.GCM(iv)
        )
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(message.encode()) + encryptor.finalize()
        
        # Store encrypted message
        db.store_group_message({
            'group_id': group_id,
            'sender_id': sender_id,
            'ciphertext': ciphertext,
            'iv': iv,
            'tag': encryptor.tag,
            'timestamp': datetime.utcnow()
        })
```

</details>

**Key Features:**
1. **Forward Secrecy**: Each message uses different key
2. **Future Secrecy**: Compromised key doesn't affect future messages
3. **Multi-Device**: Each device has own keys
4. **Group Chats**: Symmetric group key encrypted per member
5. **Server Blind**: Server can't decrypt messages

**Security Properties:**
- End-to-end encrypted
- Perfect forward secrecy
- Post-compromise security
- Deniability
- Asynchronous (offline message delivery)

---

### Q5: How would you implement GDPR compliance for user data deletion and export?

**Answer:**

**GDPR Requirements:**
1. **Right to be Forgotten**: Delete user data within 30 days
2. **Right to Data Portability**: Export all user data in machine-readable format
3. **Right to Access**: User can view what data is stored
4. **Consent Management**: Track and respect user consent
5. **Data Breach Notification**: Notify within 72 hours

**Implementation:**

<details>
<summary>Click to view code (python)</summary>

```python
from datetime import datetime, timedelta
import json
import csv
from typing import Dict, List

class GDPRComplianceService:
    def __init__(self):
        self.deletion_grace_period = timedelta(days=30)
    
    # 1. Right to be Forgotten
    def request_data_deletion(self, user_id: str, reason: str = None):
        """
        Request user data deletion (GDPR Article 17)
        - Don't delete immediately (legal hold, backups)
        - Mark for deletion
        - Anonymize instead of hard delete
        """
        user = db.get_user(user_id)
        
        if not user:
            raise Exception("User not found")
        
        # Create deletion request
        deletion_request = {
            'user_id': user_id,
            'requested_at': datetime.utcnow(),
            'scheduled_for': datetime.utcnow() + self.deletion_grace_period,
            'reason': reason,
            'status': 'pending',
            'completed_at': None
        }
        
        db.create_deletion_request(deletion_request)
        
        # Send confirmation email
        self.send_deletion_confirmation(user.email, deletion_request)
        
        return deletion_request
    
    def execute_data_deletion(self, user_id: str):
        """
        Execute data deletion after grace period
        Strategy: Anonymize instead of hard delete (preserve data integrity)
        """
        # 1. Personal Information
        user = db.get_user(user_id)
        user.email = f"deleted_{user_id}@anonymized.local"
        user.name = "Deleted User"
        user.phone = None
        user.address = None
        user.date_of_birth = None
        user.profile_picture = None
        user.bio = None
        user.is_deleted = True
        user.deleted_at = datetime.utcnow()
        db.save(user)
        
        # 2. Authentication
        db.delete_user_sessions(user_id)
        db.delete_user_tokens(user_id)
        db.delete_user_api_keys(user_id)
        db.delete_user_oauth_connections(user_id)
        
        # 3. User-generated content
        # Keep content but anonymize authorship
        posts = db.get_user_posts(user_id)
        for post in posts:
            post.author_name = "Deleted User"
            post.author_id = None
            db.save(post)
        
        comments = db.get_user_comments(user_id)
        for comment in comments:
            comment.author_name = "Deleted User"
            comment.author_id = None
            db.save(comment)
        
        # 4. Activity logs
        # Keep for legal/audit but anonymize
        logs = db.get_user_activity_logs(user_id)
        for log in logs:
            log.user_id = "anonymized"
            log.ip_address = "0.0.0.0"
            log.user_agent = "anonymized"
            db.save(log)
        
        # 5. Third-party integrations
        # Request deletion from integrated services
        self.request_third_party_deletion(user_id)
        
        # 6. Backups
        # Mark for deletion in next backup cycle
        db.mark_for_backup_deletion(user_id)
        
        # 7. Analytics
        # Anonymize in analytics database
        analytics_db.anonymize_user(user_id)
        
        # 8. Billing (keep for legal requirements)
        # Keep billing records but remove PII
        invoices = db.get_user_invoices(user_id)
        for invoice in invoices:
            invoice.customer_name = "Deleted User"
            invoice.email = f"deleted_{user_id}@anonymized.local"
            invoice.address = None
            db.save(invoice)
        
        # Update deletion request
        deletion_request = db.get_deletion_request(user_id)
        deletion_request['status'] = 'completed'
        deletion_request['completed_at'] = datetime.utcnow()
        db.save(deletion_request)
        
        # Log for audit
        self.log_gdpr_event({
            'event': 'data_deletion_completed',
            'user_id': user_id,
            'timestamp': datetime.utcnow()
        })
    
    # 2. Right to Data Portability
    def export_user_data(self, user_id: str, format: str = 'json') -> dict:
        """
        Export all user data (GDPR Article 20)
        Format: JSON or CSV
        """
        user = db.get_user(user_id)
        
        if not user:
            raise Exception("User not found")
        
        # Collect all user data
        export_data = {
            'export_info': {
                'user_id': user_id,
                'exported_at': datetime.utcnow().isoformat(),
                'format': format
            },
            
            'personal_information': {
                'email': user.email,
                'name': user.name,
                'phone': user.phone,
                'address': user.address,
                'date_of_birth': user.date_of_birth.isoformat() if user.date_of_birth else None,
                'account_created': user.created_at.isoformat(),
                'profile_picture_url': user.profile_picture,
                'bio': user.bio
            },
            
            'posts': [
                {
                    'id': post.id,
                    'title': post.title,
                    'content': post.content,
                    'created_at': post.created_at.isoformat(),
                    'likes': post.like_count,
                    'comments': post.comment_count
                }
                for post in db.get_user_posts(user_id)
            ],
            
            'comments': [
                {
                    'id': comment.id,
                    'post_id': comment.post_id,
                    'content': comment.content,
                    'created_at': comment.created_at.isoformat()
                }
                for comment in db.get_user_comments(user_id)
            ],
            
            'likes': [
                {
                    'post_id': like.post_id,
                    'liked_at': like.created_at.isoformat()
                }
                for like in db.get_user_likes(user_id)
            ],
            
            'followers': [
                {
                    'user_id': follower.id,
                    'username': follower.username,
                    'followed_at': follower.followed_at.isoformat()
                }
                for follower in db.get_user_followers(user_id)
            ],
            
            'following': [
                {
                    'user_id': following.id,
                    'username': following.username,
                    'followed_at': following.followed_at.isoformat()
                }
                for following in db.get_user_following(user_id)
            ],
            
            'messages': [
                {
                    'conversation_id': msg.conversation_id,
                    'content': msg.content,
                    'sent_at': msg.created_at.isoformat(),
                    'recipient': msg.recipient.username
                }
                for msg in db.get_user_messages(user_id)
            ],
            
            'activity_log': [
                {
                    'action': log.action,
                    'timestamp': log.timestamp.isoformat(),
                    'ip_address': log.ip_address,
                    'user_agent': log.user_agent
                }
                for log in db.get_user_activity_logs(user_id, limit=1000)
            ],
            
            'consent_records': [
                {
                    'purpose': consent.purpose,
                    'granted': consent.granted,
                    'timestamp': consent.timestamp.isoformat()
                }
                for consent in db.get_user_consents(user_id)
            ],
            
            'payment_history': [
                {
                    'invoice_id': payment.invoice_id,
                    'amount': payment.amount,
                    'currency': payment.currency,
                    'date': payment.created_at.isoformat(),
                    'description': payment.description
                }
                for payment in db.get_user_payments(user_id)
            ]
        }
        
        # Generate export file
        if format == 'json':
            export_file = self.generate_json_export(export_data)
        elif format == 'csv':
            export_file = self.generate_csv_export(export_data)
        else:
            raise Exception("Unsupported format")
        
        # Store export (temporary, auto-delete after 30 days)
        export_record = {
            'user_id': user_id,
            'file_path': export_file,
            'created_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(days=30),
            'download_count': 0
        }
        db.create_export_record(export_record)
        
        # Log for audit
        self.log_gdpr_event({
            'event': 'data_export_created',
            'user_id': user_id,
            'timestamp': datetime.utcnow()
        })
        
        # Send email with download link
        self.send_export_ready_email(user.email, export_record)
        
        return export_record
    
    def generate_json_export(self, data: dict) -> str:
        """Generate JSON export file"""
        filename = f"data_export_{data['export_info']['user_id']}_{int(time.time())}.json"
        filepath = f"/exports/{filename}"
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
        
        return filepath
    
    # 3. Consent Management
    def record_consent(
        self,
        user_id: str,
        purpose: str,
        granted: bool,
        consent_text: str
    ):
        """Record user consent for data processing"""
        consent = {
            'user_id': user_id,
            'purpose': purpose,  # e.g., 'marketing', 'analytics', 'third_party'
            'granted': granted,
            'consent_text': consent_text,
            'timestamp': datetime.utcnow(),
            'ip_address': request.remote_addr,
            'user_agent': request.headers.get('User-Agent')
        }
        
        db.create_consent_record(consent)
        
        # If consent revoked, take action
        if not granted:
            self.handle_consent_revocation(user_id, purpose)
    
    def handle_consent_revocation(self, user_id: str, purpose: str):
        """Handle consent revocation"""
        if purpose == 'marketing':
            # Unsubscribe from marketing emails
            db.update_user_preferences(user_id, {
                'marketing_emails': False
            })
        
        elif purpose == 'analytics':
            # Stop tracking in analytics
            analytics_db.opt_out_user(user_id)
        
        elif purpose == 'third_party':
            # Stop sharing with third parties
            db.update_user_preferences(user_id, {
                'third_party_sharing': False
            })
    
    # 4. Data Breach Notification
    def handle_data_breach(
        self,
        affected_user_ids: List[str],
        breach_details: dict
    ):
        """Handle data breach (GDPR Article 33/34)"""
        breach_record = {
            'id': secrets.token_hex(16),
            'detected_at': datetime.utcnow(),
            'affected_users': len(affected_user_ids),
            'breach_type': breach_details['type'],
            'description': breach_details['description'],
            'severity': breach_details['severity'],
            'notified_at': None,
            'authority_notified_at': None
        }
        
        db.create_breach_record(breach_record)
        
        # Notify supervisory authority within 72 hours
        if breach_details['severity'] in ['high', 'critical']:
            self.notify_supervisory_authority(breach_record)
        
        # Notify affected users
        for user_id in affected_user_ids:
            user = db.get_user(user_id)
            self.notify_user_of_breach(user.email, breach_record)
        
        breach_record['notified_at'] = datetime.utcnow()
        db.save(breach_record)
    
    # 5. Data Retention Policy
    def enforce_retention_policy(self):
        """Enforce data retention policies"""
        # Delete old logs
        db.delete_logs_older_than(days=365)
        
        # Delete old sessions
        db.delete_sessions_older_than(days=30)
        
        # Delete expired exports
        db.delete_expired_exports()
        
        # Anonymize old activity logs
        db.anonymize_logs_older_than(days=730)  # 2 years

# API Endpoints
@app.route('/api/gdpr/delete-account', methods=['POST'])
@require_authentication
def request_account_deletion():
    """Request account deletion"""
    user_id = g.user_id
    reason = request.json.get('reason')
    
    gdpr = GDPRComplianceService()
    deletion_request = gdpr.request_data_deletion(user_id, reason)
    
    return jsonify({
        'message': 'Deletion request created',
        'scheduled_for': deletion_request['scheduled_for'].isoformat()
    })

@app.route('/api/gdpr/export-data', methods=['POST'])
@require_authentication
def export_my_data():
    """Export user data"""
    user_id = g.user_id
    format = request.json.get('format', 'json')
    
    gdpr = GDPRComplianceService()
    export_record = gdpr.export_user_data(user_id, format)
    
    return jsonify({
        'message': 'Export created',
        'download_url': f"/api/gdpr/download/{export_record['id']}",
        'expires_at': export_record['expires_at'].isoformat()
    })

@app.route('/api/gdpr/consent', methods=['POST'])
@require_authentication
def update_consent():
    """Update consent preferences"""
    user_id = g.user_id
    purpose = request.json['purpose']
    granted = request.json['granted']
    
    gdpr = GDPRComplianceService()
    gdpr.record_consent(user_id, purpose, granted, request.json.get('consent_text', ''))
    
    return jsonify({'message': 'Consent updated'})
```

</details>

**Best Practices:**
1. **Anonymize, don't delete**: Preserve data integrity
2. **Grace period**: 30 days before deletion
3. **Audit trail**: Log all GDPR operations
4. **Automation**: Scheduled jobs for retention
5. **Third-party cleanup**: Request deletion from integrations
6. **Backups**: Include deletion in backup cycles
7. **Legal holds**: Check before deletion
8. **Export format**: Machine-readable (JSON, CSV)
9. **Consent tracking**: Detailed consent records
10. **Breach notification**: Within 72 hours

---

This comprehensive security guide covers:
- Authentication & Authorization (passwords, MFA, JWT, OAuth, RBAC, ABAC)
- API Security (input validation, rate limiting, API keys, CORS, HTTPS, request signing)
- Data Security (encryption at rest/transit, masking, tokenization)
- Network Security (DDoS protection, firewall rules)
- Application Security (XSS, CSRF, session management)
- Infrastructure Security (containers, secrets, logging)
- Compliance (GDPR, PCI DSS)
- Interview questions with detailed answers

All with production-ready code examples and best practices!
