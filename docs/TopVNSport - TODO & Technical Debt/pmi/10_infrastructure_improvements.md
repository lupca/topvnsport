# TODO: Infrastructure Improvements

## Mức độ: MEDIUM
## Estimated Effort: High (1-2 days)

---

## Mô Tả Các Vấn Đề

### 1. Missing Health Checks

**OMS/docker-compose.prod.yml** thiếu database healthcheck (PMI và WMS có).

```yaml
# OMS - MISSING healthcheck
db:
  image: postgres:15
  # No healthcheck defined
  
# PMI - HAS healthcheck (reference)
db:
  image: postgres:15
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U pmi"]
    interval: 5s
    timeout: 5s
    retries: 5
```

### 2. No Resource Limits

Không có memory/CPU limits trên bất kỳ container nào. Một service có thể consume hết resources.

```yaml
# Current - No limits
services:
  api:
    image: pmi-api
    # Missing: deploy.resources.limits
```

### 3. Single Database Instances

Mỗi database là single non-replicated instance - single point of failure.

### 4. No Redis Caching

Tất cả queries hit database trực tiếp. Không có caching layer.

### 5. Audit System Code Duplication

**PMI/backend/utils/audit.py (lines 127-320):**
`async_wrapper` và `sync_wrapper` gần như giống hệt (~200 dòng duplicate).

---

## Steps to Implement

### Fix 1: Add Health Checks to OMS

**File: OMS/docker-compose.prod.yml** (UPDATE)

```yaml
services:
  db:
    image: postgres:15
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U oms"]
      interval: 5s
      timeout: 5s
      retries: 5
    # ... rest of config

  api:
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Add health endpoint to OMS API:**

```python
# OMS/backend/routers/health.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db

router = APIRouter()

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}
```

### Fix 2: Add Resource Limits

**File: All docker-compose.prod.yml files** (UPDATE)

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  db:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G

  frontend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### Fix 3: Add Redis Caching Layer

**Step 1: Add Redis to docker-compose**

```yaml
# PMI/docker-compose.prod.yml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M

volumes:
  redis_data:
```

**Step 2: Add Redis client to API**

```python
# PMI/backend/utils/cache.py
import redis
import json
from functools import wraps
from typing import Optional, Callable
import os

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True
)

def cache(ttl_seconds: int = 300, key_prefix: str = ""):
    """Decorator for caching function results"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key
            cache_key = f"{key_prefix}:{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Try to get from cache
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            redis_client.setex(cache_key, ttl_seconds, json.dumps(result))
            
            return result
        return wrapper
    return decorator

def invalidate_cache(pattern: str):
    """Invalidate cache keys matching pattern"""
    keys = redis_client.keys(pattern)
    if keys:
        redis_client.delete(*keys)
```

**Step 3: Apply caching to frequently accessed data**

```python
# PMI/backend/services/category_service.py
from utils.cache import cache, invalidate_cache

class CategoryService:
    @cache(ttl_seconds=3600, key_prefix="categories")
    async def get_all_categories(self):
        # This will be cached for 1 hour
        return self.db.query(Category).all()
    
    async def create_category(self, data):
        category = Category(**data)
        self.db.add(category)
        self.db.commit()
        
        # Invalidate category cache
        invalidate_cache("categories:*")
        
        return category
```

### Fix 4: Refactor Audit Wrapper Duplication

**File: PMI/backend/utils/audit.py** (REFACTOR)

```python
# Before: Two nearly identical functions (async_wrapper, sync_wrapper)
# After: Single generic implementation

from typing import Callable, TypeVar, Union
from functools import wraps
import asyncio

T = TypeVar('T')

def create_audit_wrapper(func: Callable[..., T], audit_action: str) -> Callable[..., T]:
    """
    Creates an audit wrapper that works for both sync and async functions.
    """
    is_async = asyncio.iscoroutinefunction(func)
    
    if is_async:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Pre-execution audit
            context = get_audit_context()
            
            try:
                result = await func(*args, **kwargs)
                # Post-execution audit (success)
                log_audit_event(audit_action, "success", context, result)
                return result
            except Exception as e:
                # Post-execution audit (failure)
                log_audit_event(audit_action, "failure", context, error=str(e))
                raise
        
        return async_wrapper
    else:
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            context = get_audit_context()
            
            try:
                result = func(*args, **kwargs)
                log_audit_event(audit_action, "success", context, result)
                return result
            except Exception as e:
                log_audit_event(audit_action, "failure", context, error=str(e))
                raise
        
        return sync_wrapper

def log_audit_event(action: str, status: str, context: dict, result=None, error=None):
    """Unified audit logging - single implementation"""
    # ... audit logic here (was duplicated before)
    pass
```

---

## Files Cần Tạo/Modify

### New Files
| File | Description |
|------|-------------|
| `PMI/backend/utils/cache.py` | Redis caching utilities |
| `OMS/backend/routers/health.py` | Health check endpoint |
| `WMS/backend/routers/health.py` | Health check endpoint |

### Modified Files
| File | Action |
|------|--------|
| `PMI/docker-compose.prod.yml` | Add resource limits, Redis service |
| `OMS/docker-compose.prod.yml` | Add healthchecks, resource limits |
| `WMS/docker-compose.prod.yml` | Add resource limits |
| `PMI/backend/utils/audit.py` | Refactor to remove duplication |
| `PMI/backend/requirements.txt` | Add redis package |
| `PMI/backend/services/category_service.py` | Add caching |
| `PMI/backend/services/product_service.py` | Add caching for reads |

---

## Verification

### Health Checks
```bash
# Verify healthchecks are working
docker compose -f OMS/docker-compose.prod.yml ps

# Should show (healthy) status
# NAME        STATUS                    PORTS
# oms-db      Up 5 minutes (healthy)    5432/tcp
# oms-api     Up 5 minutes (healthy)    8000/tcp
```

### Resource Limits
```bash
# Verify limits applied
docker stats --no-stream

# Should show MEM LIMIT column populated
# CONTAINER    CPU %    MEM USAGE / LIMIT
# pmi-api      2.5%     512MB / 1GB
```

### Redis Caching
```bash
# Connect to Redis and verify caching
docker compose exec redis redis-cli

> KEYS categories:*
1) "categories:get_all_categories:..."

> TTL categories:get_all_categories:...
(integer) 3542  # TTL remaining
```

### Performance Test
```bash
# Before caching
time curl http://localhost:18100/api/v1/categories  # ~200ms

# After caching (second request)
time curl http://localhost:18100/api/v1/categories  # ~20ms
```

---

## Future Considerations

1. **Database Replication:**
   - Add PostgreSQL streaming replication
   - Read replicas for heavy read workloads
   
2. **CDN Integration:**
   - CloudFront or Cloudflare for static assets
   - Image optimization for product media

3. **Auto-scaling:**
   - Kubernetes or ECS for container orchestration
   - Horizontal pod autoscaler based on CPU/memory

4. **Monitoring:**
   - Prometheus + Grafana for metrics
   - ELK stack for centralized logging
