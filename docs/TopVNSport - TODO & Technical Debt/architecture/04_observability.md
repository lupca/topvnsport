# ARCHITECTURE: Centralized Observability

## Mức độ: MEDIUM
## Estimated Effort: Medium (1 week)

---

## Vấn Đề Hiện Tại

### Logging Rời Rạc

Mỗi service log riêng, không có aggregation:

```python
# PMI/backend/main.py
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pim_backend")

# OMS/backend/main.py  
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("oms_backend")

# WMS/backend/main.py
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wms_backend")
```

### Không Có Distributed Tracing

Khi request đi qua OMS → WMS → PMI, không thể trace được flow.

### Không Có Metrics

- Không biết response time trung bình
- Không biết error rate
- Không biết throughput
- Không có alerting

---

## Giải Pháp Đề Xuất

### Observability Stack

```
┌─────────────────────────────────────────────────────────┐
│                     Grafana Dashboard                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Logs    │ │ Traces  │ │ Metrics │ │ Alerts  │        │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘        │
└───────┼──────────┼──────────┼──────────┼────────────────┘
        │          │          │          │
   ┌────▼────┐ ┌───▼───┐ ┌───▼────┐ ┌───▼───┐
   │  Loki   │ │ Tempo │ │Promethe│ │Alert  │
   │         │ │       │ │us      │ │Manager│
   └────┬────┘ └───┬───┘ └───┬────┘ └───────┘
        │          │         │
        └──────────┼─────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼───┐    ┌────▼────┐    ┌────▼────┐
│  PMI  │    │   OMS   │    │   WMS   │
└───────┘    └─────────┘    └─────────┘
```

---

## Implementation

### 1. Structured Logging (JSON)

```python
# shared/logging.py
import structlog
import logging

def setup_logging(service_name: str):
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )
    
    # Add service context
    structlog.contextvars.bind_contextvars(service=service_name)
    
    return structlog.get_logger()

# Usage in services
# PMI/backend/main.py
from shared.logging import setup_logging

logger = setup_logging("pmi")

@app.post("/api/v1/products")
async def create_product(data: ProductCreate):
    logger.info("creating_product", sku=data.sku, name=data.name)
    # ...
    logger.info("product_created", product_id=product.id)
```

Output:
```json
{"timestamp": "2024-01-15T10:30:00Z", "level": "info", "service": "pmi", "event": "creating_product", "sku": "ABC123", "name": "Product Name"}
```

### 2. Request Tracing (OpenTelemetry)

```python
# shared/tracing.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

def setup_tracing(service_name: str, app: FastAPI, engine):
    # Setup tracer provider
    provider = TracerProvider()
    processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://tempo:4317"))
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)
    
    # Auto-instrument
    FastAPIInstrumentor.instrument_app(app)
    HTTPXClientInstrumentor().instrument()
    SQLAlchemyInstrumentor().instrument(engine=engine)
    
    return trace.get_tracer(service_name)

# Usage
# PMI/backend/main.py
from shared.tracing import setup_tracing

tracer = setup_tracing("pmi", app, engine)

@app.post("/api/v1/products")
async def create_product(data: ProductCreate):
    with tracer.start_as_current_span("create_product") as span:
        span.set_attribute("product.sku", data.sku)
        # ... business logic
```

### 3. Metrics (Prometheus)

```python
# shared/metrics.py
from prometheus_client import Counter, Histogram, generate_latest
from fastapi import Response

# Define metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['service', 'method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['service', 'method', 'endpoint'],
    buckets=[.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10]
)

ORDER_COUNT = Counter(
    'orders_total',
    'Total orders',
    ['service', 'status', 'channel']
)

def setup_metrics(app: FastAPI, service_name: str):
    @app.middleware("http")
    async def metrics_middleware(request, call_next):
        import time
        start = time.time()
        
        response = await call_next(request)
        
        duration = time.time() - start
        REQUEST_COUNT.labels(
            service=service_name,
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()
        
        REQUEST_LATENCY.labels(
            service=service_name,
            method=request.method,
            endpoint=request.url.path
        ).observe(duration)
        
        return response
    
    @app.get("/metrics")
    async def metrics():
        return Response(generate_latest(), media_type="text/plain")
```

### 4. Docker Compose - Observability Stack

```yaml
# docker-compose.observability.yml
version: "3.8"

services:
  # Log aggregation
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - loki_data:/loki

  # Distributed tracing
  tempo:
    image: grafana/tempo:2.3.0
    ports:
      - "3200:3200"   # tempo
      - "4317:4317"   # otlp grpc
    command: -config.file=/etc/tempo/tempo.yaml
    volumes:
      - ./observability/tempo.yaml:/etc/tempo/tempo.yaml
      - tempo_data:/var/tempo

  # Metrics
  prometheus:
    image: prom/prometheus:v2.47.0
    ports:
      - "9090:9090"
    volumes:
      - ./observability/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  # Dashboards
  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3001:3000"
    environment:
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_AUTH_ANONYMOUS_ORG_ROLE: "Admin"
    volumes:
      - ./observability/grafana/provisioning:/etc/grafana/provisioning
      - grafana_data:/var/lib/grafana

  # Alerting
  alertmanager:
    image: prom/alertmanager:v0.26.0
    ports:
      - "9093:9093"
    volumes:
      - ./observability/alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  loki_data:
  tempo_data:
  prometheus_data:
  grafana_data:
```

### 5. Prometheus Config

```yaml
# observability/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - /etc/prometheus/rules/*.yml

scrape_configs:
  - job_name: 'pmi'
    static_configs:
      - targets: ['pim-api:8000']
    metrics_path: /metrics
    
  - job_name: 'oms'
    static_configs:
      - targets: ['oms_backend:8001']
    metrics_path: /metrics
    
  - job_name: 'wms'
    static_configs:
      - targets: ['wms-api:8002']
    metrics_path: /metrics
```

### 6. Alert Rules

```yaml
# observability/rules/alerts.yml
groups:
  - name: service_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency on {{ $labels.service }}"
          
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
```

---

## Files Cần Tạo

| File | Description |
|------|-------------|
| `shared/logging.py` | Structured logging setup |
| `shared/tracing.py` | OpenTelemetry setup |
| `shared/metrics.py` | Prometheus metrics |
| `docker-compose.observability.yml` | Observability stack |
| `observability/prometheus.yml` | Prometheus config |
| `observability/tempo.yaml` | Tempo config |
| `observability/alertmanager.yml` | Alert config |
| `observability/rules/alerts.yml` | Alert rules |
| `observability/grafana/provisioning/` | Grafana dashboards |

---

## Grafana Dashboards

Pre-built dashboards cần tạo:

1. **Service Overview** - Request rate, error rate, latency per service
2. **Order Flow** - Order creation → fulfillment → shipping pipeline
3. **Database Performance** - Query latency, connection pool
4. **Infrastructure** - CPU, memory, disk per container

---

## Verification

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Loki logs
curl -G http://localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={service="pmi"}'

# Check Tempo traces
curl http://localhost:3200/api/search

# Access Grafana
open http://localhost:3001
```
