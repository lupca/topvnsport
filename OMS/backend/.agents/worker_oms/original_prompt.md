## 2026-06-29T14:20:00Z
We are ready to proceed with OMS backend modifications (R2 and relevant R4 standards).
I will spawn you as the Implementer Worker for the OMS backend.
Your goals:
- R2: OMS Backend Fixes and Endpoints:
  Implement `GET /dashboard/stats` returning order count, revenue, customer count, status counts.
  Implement `PUT /orders/{id}` to allow editing orders while they are in `DRAFT` status.
  Implement `DELETE /orders/{id}` to delete draft orders.
  Implement `GET /products/search` proxying queries to PMI `http://pim-api:8000/products` or `http://localhost:8000/products` using `httpx`.
  Implement filter, search, and pagination metadata (total count, page, pages, limit) on `GET /orders` (filter by status, channel_id, date, and search customer name/phone or order number).
  Auto-generate `order_number` with format `ORD-YYYYMMDD-XXXX` (using YYYYMMDD prefix and a database counter or auto-incrementing suffix format).
  Block cancellation of orders that are already `COMPLETED`.
  Ensure order cancellation requests cancel fulfillment in WMS if status is `PICKING` or `PACKED` (in addition to `PROCESSING`).
  Validate state flow in `PATCH /orders/{id}/status` callback (e.g. check status transition validity; do not accept arbitrary strings).
  Seed initial channels data (`Manual`, `Shopee`, `TikTok Shop`, `Lazada`).
  Add CORS middleware to allow the frontend to access the backend.
- R4: Code Quality & Standards (OMS and WMS where appropriate):
  Use `Numeric(10,2)` (Decimal) instead of `Float` for all monetary/price fields in OMS models (`total_amount`, `shipping_fee`, `unit_price`, `subtotal`). Update schemas to use `Decimal`.
  Replace deprecated imports (e.g., `declarative_base()` from SQLAlchemy 2.0+, `datetime.utcnow()`).
  Pin package versions in `requirements.txt` to ensure reproducible builds.
  Use environment variables for service URLs (PMI, WMS, OMS) instead of hardcoding (defaulting to the existing compose values if not set).
  Use `httpx` instead of `urllib` for inter-service HTTP requests.
  Add logging.
