# WMS Public API for Stock (Requirement R1) — Comprehensive Technical Analysis Report

## 1. Executive Summary
This report provides a comprehensive technical investigation of Requirement R1: WMS Public API for Stock in the `topvnsport` codebase. The investigation examined the WMS backend codebase architecture, data models, location structure, inventory storage, stock aggregation methods, existing API endpoints, and requirements for a new multi-SKU aggregated stock availability public API.

Key Findings:
1. **Architecture**: WMS Backend is a FastAPI Python service using SQLAlchemy ORM and Pydantic schemas.
2. **Stock Model**: Inventory is stored at the granular `(sku_code, location_id)` level in the `inventories` table. Available stock per record is calculated via property `qty_available = qty_on_hand - qty_reserved`.
3. **Current Aggregation**: Aggregation across locations/warehouses is currently NOT performed in WMS backend; external consumers like OMS (`_fetch_inventory_snapshot` in `OMS/backend/main.py`) pull the entire `GET /inventory` table dump and sum stock in client-side memory.
4. **API Gap**: Existing inventory endpoints (`GET /inventory`) require full user authentication (`get_current_user`), do not support SKU filtering (multi-SKU or single SKU), and do not return aggregated stock by SKU across locations.
5. **Proposed Solution**: Introduce a new public endpoint route (e.g. `GET /public/stock` or `POST /public/stock/query`) using `get_optional_user` or public router access, performing server-side database SQL aggregation (`GROUP BY sku_code`) with multi-SKU query support.

---

## 2. WMS Backend Codebase Structure & Architecture

### 2.1 Codebase Layout
- **Root Location**: `/home/lupca/projects/topvnsport/WMS/backend/`
- **Primary Files & Modules**:
  - `main.py`: FastAPI application initialization, middleware (CORS), system status routes (`/health`, `/status`, `/dashboard/stats`), and router inclusion.
  - `database.py`: SQLAlchemy engine setup (`create_engine`), session factory (`SessionLocal`), base class (`Base`), and FastAPI dependency (`get_db`).
  - `models.py`: SQLAlchemy database ORM definitions.
  - `schemas.py`: Pydantic validation models (v2 syntax using `ConfigDict(from_attributes=True)`).
  - `routers/`:
    - `warehouses.py`: Warehouse and Location CRUD operations (`/warehouses`, `/locations`).
    - `inventory.py`: Inventory list, manual adjustment, and inter-location transfers (`/inventory`, `/inventory/adjust`, `/inventory/transfer`).
    - `fulfillment.py`: Fulfillment order creation, picking, packing, shipping, cancellation (`/fulfillment-orders`).
    - `inbound.py`: Inbound shipment creation, scan-receiving (`/inbound-shipments`).
    - `barcode_mappings.py`: Barcode mapping CRUD and PMI sync (`/barcode-mappings`).
    - `transactions.py`: Audit log of stock movements (`/stock-transactions`).
  - `utils/`:
    - `auth.py`: Authentication helpers (`get_current_user`, `get_optional_user`). Supports Gateway headers (`X-User-Id`), JWT Bearer token, and `X-API-Key` matching `INTERNAL_SERVICE_TOKEN`.
    - `helpers.py`: Stock logging helper (`log_stock_transaction`) and OMS webhook caller (`notify_oms_status`).

### 2.2 Framework & Core Dependencies
- **Python**: 3.14+
- **Web Framework**: `FastAPI` (v1.0.0 API specification)
- **ORM**: `SQLAlchemy` 2.x declarative ORM
- **Database Engine**: PostgreSQL in production (default DSN `postgresql://postgres:postgres@localhost:15435/wms_db`), SQLite fallback in tests (`/tmp/test.db`)
- **Authentication**: FastAPI security dependencies supporting Gateway HTTP headers, HS256 JWT decoding (`python-jose`), and internal API keys.

---

## 3. Data Models & Location Handling

### 3.1 Warehouse & Location Models (`WMS/backend/models.py`)
```python
class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True) # e.g. "WH-MAIN"
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    locations = relationship("Location", back_populates="warehouse", cascade="all, delete-orphan")
```

```python
class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    location_code = Column(String, unique=True, nullable=False, index=True) # e.g. "A-01-01"
    zone = Column(String, nullable=True)
    aisle = Column(String, nullable=True)
    rack = Column(String, nullable=True)
    shelf = Column(String, nullable=True)
    type = Column(String, nullable=True)  # e.g., pick, reserve, stage
    is_active = Column(Boolean, default=True)

    warehouse = relationship("Warehouse", back_populates="locations")
    inventories = relationship("Inventory", back_populates="location", cascade="all, delete-orphan")
```

Key Observations on Locations:
- Hierarchy is strictly 2-tier: `Warehouse` -> `Location`.
- Each `Location` belongs to exactly 1 `Warehouse` via `warehouse_id`.
- `location_code` is globally unique across all warehouses.

### 3.2 Stock Data Model (`Inventory`)
```python
class Inventory(Base):
    __tablename__ = "inventories"
    __table_args__ = (
        UniqueConstraint("sku_code", "location_id", name="uq_inventory_sku_location"),
    )

    id = Column(Integer, primary_key=True, index=True)
    sku_code = Column(String, nullable=False, index=True)
    product_name = Column(String, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    qty_on_hand = Column(Integer, default=0, nullable=False)
    qty_reserved = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    location = relationship("Location", back_populates="inventories")

    @property
    def qty_available(self):
        return self.qty_on_hand - self.qty_reserved
```

Key Properties of Stock Data Model:
- **Granularity**: Stored per `(sku_code, location_id)`.
- **`qty_on_hand`**: Physical total quantity present at this location.
- **`qty_reserved`**: Allocated quantity reserved for active fulfillment orders (picking/packing) at this location.
- **`qty_available`**: Calculated property (`qty_on_hand - qty_reserved`).

---

## 4. Stock Storage & Location Aggregation Analysis

### 4.1 How Stock is Stored
Stock in WMS is fragmented across individual locations. For example, SKU `SKU-FOOTBALL-01` might exist in:
- Location 1 (Warehouse WH-1, Bin A1): `qty_on_hand` = 20, `qty_reserved` = 5 (`qty_available` = 15)
- Location 2 (Warehouse WH-1, Bin B2): `qty_on_hand` = 30, `qty_reserved` = 0 (`qty_available` = 30)
- Location 3 (Warehouse WH-2, Bin C1): `qty_on_hand` = 50, `qty_reserved` = 10 (`qty_available` = 40)

### 4.2 Aggregation Logic
To get the aggregated stock for `SKU-FOOTBALL-01`:
- **Total Physical Stock (`total_qty_on_hand`)**: $\sum \text{qty\_on\_hand} = 20 + 30 + 50 = 100$
- **Total Reserved Stock (`total_qty_reserved`)**: $\sum \text{qty\_reserved} = 5 + 0 + 10 = 15$
- **Total Available Stock (`total_qty_available`)**: $\sum \text{qty\_available} = 15 + 30 + 40 = 85$ (or $100 - 15 = 85$)

### 4.3 Current Anti-Pattern in Codebase (`OMS/backend/main.py`)
In `OMS/backend/main.py::_fetch_inventory_snapshot`:
```python
# Lines 169-172
warehouses_resp = client.get(f"{WMS_API_URL}/warehouses")
inventory_resp = client.get(f"{WMS_API_URL}/inventory")
locations_resp = client.get(f"{WMS_API_URL}/locations")
```
OMS executes a full database dump of `/inventory`, `/locations`, and `/warehouses` and iterates through all records in Python to compute available stock per warehouse and SKU.
- **Flaws**:
  1. Performance degrades linearly with DB size ($O(N)$ memory & bandwidth).
  2. Heavy redundant network traffic for multi-SKU order processing.
  3. Risk of timeout as inventory count scales.

---

## 5. Existing API Endpoints vs. New Requirement R1 API

### 5.1 Existing Inventory Endpoint Assessment
- **Endpoint**: `GET /inventory` (`WMS/backend/routers/inventory.py::list_inventory`)
- **Implementation**: `return db.query(models.Inventory).all()`
- **Limitations**:
  1. **No Filter Parameters**: Cannot filter by `sku_code`, `sku_codes`, `location_id`, or `warehouse_id`.
  2. **No Aggregation**: Returns un-aggregated per-location inventory rows.
  3. **Strict Authentication**: Requires `Depends(get_current_user)`. Public/guest access or external storefronts receive `401 Unauthorized`.

### 5.2 Required Specification for New Public Stock Endpoint (Requirement R1)

To solve Requirement R1, WMS needs a dedicated public stock API endpoint.

#### Proposed Endpoint Specification
- **Path**: `GET /public/stock` or `POST /public/stock/query`
- **Auth**: Public / Optional Auth (`Depends(get_optional_user)` or `X-API-Key`)
- **Query Parameters**:
  - `sku_codes`: List of SKU codes (comma-separated query param `?sku_codes=SKU1,SKU2` or JSON body array `{"sku_codes": ["SKU1", "SKU2"]}`).
  - `warehouse_code` (Optional): Filter availability by specific warehouse.
  - `include_locations` (Optional bool, default `False`): Include per-location breakdown.

#### Example Request & Response Schemas
**Request**: `GET /public/stock?sku_codes=SKU-FOOTBALL-01,SKU-SHOES-42`

**Response (`200 OK`)**:
```json
{
  "items": [
    {
      "sku_code": "SKU-FOOTBALL-01",
      "product_name": "Pro Football Size 5",
      "total_qty_on_hand": 100,
      "total_qty_reserved": 15,
      "total_qty_available": 85,
      "warehouses": [
        {
          "warehouse_code": "WH-MAIN",
          "warehouse_name": "Main Warehouse",
          "qty_on_hand": 50,
          "qty_reserved": 5,
          "qty_available": 45
        },
        {
          "warehouse_code": "WH-SOUTH",
          "warehouse_name": "South Regional Warehouse",
          "qty_on_hand": 50,
          "qty_reserved": 10,
          "qty_available": 40
        }
      ]
    }
  ]
}
```

#### High-Efficiency Database Aggregation Query Design
```python
@router.get("/public/stock")
def get_public_stock_availability(
    sku_codes: Optional[str] = Query(None, description="Comma-separated list of SKU codes"),
    warehouse_code: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(
        models.Inventory.sku_code,
        func.max(models.Inventory.product_name).label("product_name"),
        func.sum(models.Inventory.qty_on_hand).label("total_qty_on_hand"),
        func.sum(models.Inventory.qty_reserved).label("total_qty_reserved"),
        func.sum(models.Inventory.qty_on_hand - models.Inventory.qty_reserved).label("total_qty_available")
    ).join(models.Location).join(models.Warehouse)

    if warehouse_code:
        query = query.filter(models.Warehouse.code == warehouse_code)

    if sku_codes:
        sku_list = [s.strip() for s in sku_codes.split(",") if s.strip()]
        if sku_list:
            query = query.filter(models.Inventory.sku_code.in_(sku_list))

    results = query.group_by(models.Inventory.sku_code).all()

    return {
        "items": [
            {
                "sku_code": row.sku_code,
                "product_name": row.product_name,
                "total_qty_on_hand": int(row.total_qty_on_hand or 0),
                "total_qty_reserved": int(row.total_qty_reserved or 0),
                "total_qty_available": max(0, int(row.total_qty_available or 0))
            }
            for row in results
        ]
    }
```

---

## 6. Recommendations & Implementation Roadmap
1. **Create `routers/public_stock.py`**: Add public stock query router to WMS backend.
2. **Mount in `main.py`**: Include public router in `main.py` **without** global `Depends(get_current_user)`.
3. **Refactor OMS Integration**: Update `OMS/backend/main.py::_fetch_inventory_snapshot` to call the new `/public/stock` aggregated API instead of fetching full raw inventory dumps.
4. **Add Unit & E2E Tests**: Implement test coverage for single-SKU, multi-SKU, non-existent SKU, and warehouse-filtered queries.
