# Plan: Thêm Giá Vốn, Thuế Suất Mặc Định và Cải Thiện Đồng Bộ Barcode PMI → WMS

## Context

### Vấn đề hiện tại
1. **Không có giá vốn** (`cost_price`) ở bất kỳ đâu trong hệ thống → không tính được lợi nhuận
2. **Không có thuế suất** (`tax_rate`) ở level variant → không tính được thuế tự động
3. WMS sync barcode từ PMI nhưng **tự tạo fake barcode** `BAR-{sku}` thay vì dùng barcode thật từ PMI
4. Sync endpoint chỉ lấy **100 sản phẩm đầu** (không có pagination)
5. Frontend WMS **không có nút sync** thủ công

### Giải pháp
Hybrid approach:
- **PMI**: Lưu giá vốn và thuế suất mặc định (tham chiếu)
- **WMS**: Cache cost/tax khi sync, track giá nhập thực tế per shipment qua `InboundItem.unit_cost`

---

## Phase 1: PMI Backend - Thêm Fields cho ProductVariant

### 1.1 Tạo Migration

**File mới**: `PMI/backend/alembic/versions/{timestamp}_add_cost_tax_to_variants.py`

```python
"""Add default_cost_price and default_tax_rate to product_variants

Revision ID: {auto_generate}
Revises: {previous_revision}
Create Date: {auto_generate}
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{auto_generate}'
down_revision = '{previous_revision}'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('product_variants', 
        sa.Column('default_cost_price', sa.Numeric(12, 2), nullable=True))
    op.add_column('product_variants', 
        sa.Column('default_tax_rate', sa.Numeric(5, 2), nullable=True))

def downgrade():
    op.drop_column('product_variants', 'default_tax_rate')
    op.drop_column('product_variants', 'default_cost_price')
```

**Chạy migration**:
```bash
docker compose -f PMI/docker-compose.yml exec api alembic revision --autogenerate -m "add_cost_tax_to_variants"
docker compose -f PMI/docker-compose.yml exec api alembic upgrade head
```

---

### 1.2 Cập nhật Model

**File**: `PMI/backend/models.py`

**Vị trí**: Class `ProductVariant` (~line 91-104)

**Thêm sau `stock`**:
```python
class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    tier_1_option = Column(String(100), nullable=True)
    tier_2_option = Column(String(100), nullable=True)
    sku_code = Column(String(100), unique=True, nullable=False, index=True)
    price = Column(Numeric(12, 2), nullable=False)
    barcode = Column(String(255), nullable=True)
    stock = Column(Integer, nullable=False)
    # ===== THÊM MỚI =====
    default_cost_price = Column(Numeric(12, 2), nullable=True)  # Giá vốn tham chiếu (VND)
    default_tax_rate = Column(Numeric(5, 2), nullable=True)     # Thuế suất % (VD: 10.00 = 10%)
    # ====================

    product = relationship("Product", back_populates="variants")
    media = relationship("ProductMedia", back_populates="variant", cascade="all, delete-orphan")
```

---

### 1.3 Cập nhật Pydantic Schemas

**File**: `PMI/backend/schemas/tier_variation.py`

**Cập nhật `ProductVariantBase`** (~line 20-27):
```python
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

class ProductVariantBase(BaseModel):
    tier_1_option: Optional[str] = Field(None, max_length=100)
    tier_2_option: Optional[str] = Field(None, max_length=100)
    sku_code: Optional[str] = Field(None, max_length=100)
    price: Decimal = Field(..., ge=0)
    barcode: Optional[str] = Field(None, max_length=255)
    stock: int = Field(..., ge=0)
    # ===== THÊM MỚI =====
    default_cost_price: Optional[Decimal] = Field(None, ge=0, description="Giá vốn tham chiếu (VND)")
    default_tax_rate: Optional[Decimal] = Field(None, ge=0, le=100, description="Thuế suất mặc định (%)")
    # ====================

class ProductVariantCreate(ProductVariantBase):
    pass

class ProductVariantResponse(ProductVariantBase):
    id: int
    product_id: int
    # ===== THÊM MỚI =====
    default_cost_price: Optional[Decimal] = None
    default_tax_rate: Optional[Decimal] = None
    # ====================
    model_config = ConfigDict(from_attributes=True)
```

---

### 1.4 Cập nhật Public API Schema

**File**: `PMI/backend/routers/public.py`

**Cập nhật `PublicVariantResponse`** (~line 41-51):
```python
class PublicVariantResponse(BaseModel):
    id: int
    product_id: int
    tier_1_option: Optional[str] = None
    tier_2_option: Optional[str] = None
    sku_code: str
    price: float
    barcode: Optional[str] = None
    stock: int
    # ===== THÊM MỚI =====
    default_cost_price: Optional[float] = None
    default_tax_rate: Optional[float] = None
    # ====================
    model_config = ConfigDict(from_attributes=True)
```

---

## Phase 2: WMS Backend - Cập nhật Schema

### 2.1 Cập nhật BarcodeMapping Model

**File**: `WMS/backend/models.py`

**Vị trí**: Class `BarcodeMapping` (~line 60-71)

```python
class BarcodeMapping(Base):
    __tablename__ = "barcode_mappings"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String, unique=True, nullable=False, index=True)
    barcode_type = Column(String, nullable=True)  # EAN-13, UPC, SKU
    sku_code = Column(String, nullable=False, index=True)
    product_name = Column(String, nullable=False)
    variant_name = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # ===== THÊM MỚI =====
    cost_price = Column(Numeric(12, 2), nullable=True)      # Cache giá vốn từ PMI
    tax_rate = Column(Numeric(5, 2), nullable=True)         # Cache thuế suất từ PMI (%)
    pmi_variant_id = Column(Integer, nullable=True)         # ID variant bên PMI
    last_synced_at = Column(DateTime, nullable=True)        # Thời điểm sync gần nhất
    # ====================
```

---

### 2.2 Cập nhật InboundItem Model

**File**: `WMS/backend/models.py`

**Vị trí**: Class `InboundItem` (~line 91-104)

```python
class InboundItem(Base):
    __tablename__ = "inbound_items"

    id = Column(Integer, primary_key=True, index=True)
    inbound_shipment_id = Column(Integer, ForeignKey("inbound_shipments.id", ondelete="CASCADE"))
    sku_code = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    expected_qty = Column(Integer, nullable=False)
    received_qty = Column(Integer, default=0)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    status = Column(String, default="pending")  # pending, partial, received
    # ===== THÊM MỚI =====
    unit_cost = Column(Numeric(12, 2), nullable=True)  # Giá nhập thực tế của lô hàng này (VND)
    # ====================

    inbound_shipment = relationship("InboundShipment", back_populates="items")
    location = relationship("Location")
```

---

### 2.3 Thêm Inline Migration

**File**: `WMS/backend/main.py`

**Vị trí**: Sau block migration hiện tại (~line 25-39), thêm block mới:

```python
# ===== MIGRATION: Add cost/tax fields to barcode_mappings and inbound_items =====
try:
    with engine.begin() as conn:
        conn.execute(text("""
            DO $$
            BEGIN
                -- barcode_mappings: cost_price
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='barcode_mappings' AND column_name='cost_price') THEN
                    ALTER TABLE barcode_mappings ADD COLUMN cost_price NUMERIC(12,2);
                END IF;
                
                -- barcode_mappings: tax_rate
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='barcode_mappings' AND column_name='tax_rate') THEN
                    ALTER TABLE barcode_mappings ADD COLUMN tax_rate NUMERIC(5,2);
                END IF;
                
                -- barcode_mappings: pmi_variant_id
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='barcode_mappings' AND column_name='pmi_variant_id') THEN
                    ALTER TABLE barcode_mappings ADD COLUMN pmi_variant_id INTEGER;
                END IF;
                
                -- barcode_mappings: last_synced_at
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='barcode_mappings' AND column_name='last_synced_at') THEN
                    ALTER TABLE barcode_mappings ADD COLUMN last_synced_at TIMESTAMP;
                END IF;
                
                -- inbound_items: unit_cost
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='inbound_items' AND column_name='unit_cost') THEN
                    ALTER TABLE inbound_items ADD COLUMN unit_cost NUMERIC(12,2);
                END IF;
            END $$;
        """))
    logger.info("Migration: cost/tax fields added successfully")
except Exception as e:
    logger.error(f"Migration error (cost_tax_fields): {e}")
# ===== END MIGRATION =====
```

---

### 2.4 Cập nhật Pydantic Schemas

**File**: `WMS/backend/schemas.py`

**Cập nhật `BarcodeMappingBase`** (~line 55-70):
```python
class BarcodeMappingBase(BaseModel):
    barcode: str
    barcode_type: Optional[str] = None
    sku_code: str
    product_name: str
    variant_name: Optional[str] = None
    image_url: Optional[str] = None
    # ===== THÊM MỚI =====
    cost_price: Optional[float] = None
    tax_rate: Optional[float] = None
    # ====================

class BarcodeMappingCreate(BarcodeMappingBase):
    pass

class BarcodeMappingResponse(BarcodeMappingBase):
    id: int
    created_at: datetime
    # ===== THÊM MỚI =====
    pmi_variant_id: Optional[int] = None
    last_synced_at: Optional[datetime] = None
    # ====================
    model_config = ConfigDict(from_attributes=True)
```

**Cập nhật `InboundItemBase`** (~line 72-87):
```python
class InboundItemBase(BaseModel):
    sku_code: str
    product_name: str
    expected_qty: int
    received_qty: Optional[int] = 0
    location_id: Optional[int] = None
    status: Optional[str] = "pending"
    # ===== THÊM MỚI =====
    unit_cost: Optional[float] = None  # Giá nhập thực tế (VND)
    # ====================

class InboundItemCreate(InboundItemBase):
    pass

class InboundItemResponse(InboundItemBase):
    id: int
    inbound_shipment_id: int
    # ===== THÊM MỚI =====
    unit_cost: Optional[float] = None
    # ====================
    model_config = ConfigDict(from_attributes=True)
```

---

## Phase 3: WMS Backend - Rewrite Sync Endpoint

**File**: `WMS/backend/main.py`

**Vị trí**: Thay thế endpoint `/products/sync` hiện tại (~line 988-1024)

```python
@app.post("/products/sync")
def sync_products_from_pmi(db: Session = Depends(get_db)):
    """
    Đồng bộ tất cả sản phẩm từ PMI sang WMS BarcodeMapping.
    
    Cải tiến:
    - Dùng barcode thật từ PMI (fallback sang sku_code nếu không có)
    - Pagination để sync TẤT CẢ sản phẩm
    - Cache cost_price và tax_rate từ PMI
    - Track thời điểm sync
    """
    import urllib.request
    import json
    import os
    
    pmi_base_url = os.getenv("PMI_API_URL", "http://pim-api:8000")
    synced_count = 0
    created_count = 0
    updated_count = 0
    page = 1
    limit = 100
    
    while True:
        # Fetch products từ PMI với pagination
        pmi_url = f"{pmi_base_url}/public/products?page={page}&limit={limit}"
        try:
            req = urllib.request.Request(pmi_url, method="GET")
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
                products = data.get("items", [])
                total_pages = data.get("pages", 1)
        except Exception as e:
            logger.error(f"Failed to fetch products from PMI page {page}: {e}")
            raise HTTPException(
                status_code=500, 
                detail=f"Không thể kết nối đến PMI: {str(e)}"
            )
        
        if not products:
            break
        
        for prod in products:
            for var in prod.get("variants", []):
                sku = var.get("sku_code")
                if not sku:
                    continue
                
                # === Xác định barcode ===
                # Ưu tiên dùng barcode thật từ PMI, fallback sang SKU
                pmi_barcode = var.get("barcode")
                if pmi_barcode and pmi_barcode.strip():
                    barcode = pmi_barcode.strip()
                    barcode_type = "EAN-13"  # hoặc detect type
                else:
                    barcode = sku
                    barcode_type = "SKU"
                
                # === Lấy cost và tax từ PMI ===
                cost_price = var.get("default_cost_price")
                tax_rate = var.get("default_tax_rate")
                pmi_variant_id = var.get("id")
                
                # === Build variant_name ===
                parts = []
                if var.get("tier_1_option"):
                    parts.append(var.get("tier_1_option"))
                if var.get("tier_2_option"):
                    parts.append(var.get("tier_2_option"))
                variant_name = " / ".join(parts) if parts else "Standard"
                
                # === Lấy image URL ===
                image_url = None
                media = prod.get("media", [])
                if media:
                    # Ưu tiên ảnh cover
                    cover = next((m for m in media if m.get("is_cover")), None)
                    image_url = (cover or media[0]).get("image_url")
                
                # === Upsert by sku_code ===
                existing = db.query(models.BarcodeMapping).filter(
                    models.BarcodeMapping.sku_code == sku
                ).first()
                
                if not existing:
                    # Kiểm tra barcode collision (barcode trùng với SKU khác)
                    barcode_collision = db.query(models.BarcodeMapping).filter(
                        models.BarcodeMapping.barcode == barcode,
                        models.BarcodeMapping.sku_code != sku
                    ).first()
                    
                    if barcode_collision:
                        # Xử lý collision: append SKU suffix
                        barcode = f"{barcode}-{sku}"
                        logger.warning(f"Barcode collision detected, using: {barcode}")
                    
                    # Tạo mới
                    bm = models.BarcodeMapping(
                        barcode=barcode,
                        barcode_type=barcode_type,
                        sku_code=sku,
                        product_name=prod.get("name", ""),
                        variant_name=variant_name,
                        image_url=image_url,
                        cost_price=cost_price,
                        tax_rate=tax_rate,
                        pmi_variant_id=pmi_variant_id,
                        last_synced_at=datetime.utcnow()
                    )
                    db.add(bm)
                    created_count += 1
                else:
                    # Cập nhật existing
                    # Chỉ update barcode nếu PMI có barcode thật
                    if pmi_barcode and pmi_barcode.strip():
                        existing.barcode = pmi_barcode.strip()
                        existing.barcode_type = "EAN-13"
                    
                    existing.product_name = prod.get("name", "")
                    existing.variant_name = variant_name
                    existing.image_url = image_url
                    existing.cost_price = cost_price
                    existing.tax_rate = tax_rate
                    existing.pmi_variant_id = pmi_variant_id
                    existing.last_synced_at = datetime.utcnow()
                    updated_count += 1
                
                synced_count += 1
        
        logger.info(f"Synced page {page}/{total_pages}, products so far: {synced_count}")
        
        # Check if more pages
        if page >= total_pages:
            break
        page += 1
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"Đồng bộ thành công {synced_count} sản phẩm",
        "synced_count": synced_count,
        "created_count": created_count,
        "updated_count": updated_count,
        "pages_processed": page
    }
```

---

## Phase 4: WMS Frontend - Nút Đồng Bộ

**File**: `WMS/frontend/src/app/(desktop)/barcode-mappings/page.tsx`

### 4.1 Thêm Import và State

**Vị trí**: Đầu file, thêm import:
```typescript
import { RefreshCw } from "lucide-react";
```

**Vị trí**: Trong component, thêm state:
```typescript
const [syncing, setSyncing] = useState(false);
```

### 4.2 Thêm Handler Function

**Vị trí**: Sau các handler khác:
```typescript
const handleSyncFromPMI = async () => {
  const confirmed = await showConfirm(
    "Bạn có chắc muốn đồng bộ sản phẩm từ PMI?\n\nQuá trình này sẽ cập nhật mã vạch, giá vốn và thuế suất cho tất cả sản phẩm."
  );
  
  if (!confirmed) return;
  
  try {
    setSyncing(true);
    setError(null);
    
    const res = await fetch(`${APP_SETTINGS.api.baseUrl}/products/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Đồng bộ thất bại");
    }
    
    const result = await res.json();
    
    // Refresh table
    await fetchMappings();
    
    // Show success message
    void popupService.alert(
      `Đồng bộ thành công!\n\n` +
      `- Tổng: ${result.synced_count} sản phẩm\n` +
      `- Mới tạo: ${result.created_count}\n` +
      `- Cập nhật: ${result.updated_count}`
    );
    
  } catch (err: any) {
    const errorMsg = err.message || "Lỗi không xác định khi đồng bộ";
    setError(errorMsg);
    void popupService.alert(`Lỗi: ${errorMsg}`);
  } finally {
    setSyncing(false);
  }
};
```

### 4.3 Thêm Nút Sync vào Header

**Vị trí**: Trong phần header buttons (tìm nút "Quét mã vạch" hoặc "Scan"), thêm TRƯỚC nút đó:

```tsx
{/* Nút Đồng bộ từ PMI */}
<button
  onClick={handleSyncFromPMI}
  disabled={syncing}
  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
>
  {syncing ? (
    <>
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span>Đang đồng bộ...</span>
    </>
  ) : (
    <>
      <RefreshCw className="w-4 h-4" />
      <span>Đồng bộ từ PMI</span>
    </>
  )}
</button>
```

### 4.4 (Optional) Thêm Cột Giá Vốn / Thuế Suất vào Table

**Cập nhật interface**:
```typescript
interface BarcodeMapping {
  id: number;
  barcode: string;
  barcode_type: string | null;
  sku_code: string;
  product_name: string;
  variant_name: string | null;
  image_url: string | null;
  cost_price: number | null;      // MỚI
  tax_rate: number | null;        // MỚI
  last_synced_at: string | null;  // MỚI
  created_at: string;
}
```

**Thêm columns vào table** (nếu muốn hiển thị):
```tsx
// Thêm vào columns array
{
  key: "cost_price",
  label: "Giá vốn",
  className: "text-right",
  render: (item: BarcodeMapping) => (
    <span className="text-gray-700 dark:text-gray-300">
      {item.cost_price 
        ? new Intl.NumberFormat('vi-VN').format(item.cost_price) + 'đ'
        : '-'
      }
    </span>
  )
},
{
  key: "tax_rate",
  label: "Thuế",
  className: "text-right",
  render: (item: BarcodeMapping) => (
    <span className="text-gray-700 dark:text-gray-300">
      {item.tax_rate != null ? `${item.tax_rate}%` : '-'}
    </span>
  )
},
```

---

## Thứ Tự Triển Khai

```
┌─────────────────────────────────────────────────────────────┐
│  1. PMI Backend (deploy trước WMS)                          │
│     ├── 1.1 Tạo + chạy migration                            │
│     ├── 1.2 Cập nhật models.py                              │
│     ├── 1.3 Cập nhật schemas/tier_variation.py              │
│     ├── 1.4 Cập nhật routers/public.py                      │
│     └── 1.5 Restart PMI API                                 │
├─────────────────────────────────────────────────────────────┤
│  2. Verify PMI                                              │
│     └── GET /public/products → check có cost_price, tax_rate│
├─────────────────────────────────────────────────────────────┤
│  3. WMS Backend                                             │
│     ├── 3.1 Cập nhật models.py (BarcodeMapping, InboundItem)│
│     ├── 3.2 Thêm inline migration vào main.py               │
│     ├── 3.3 Cập nhật schemas.py                             │
│     ├── 3.4 Rewrite sync endpoint                           │
│     └── 3.5 Restart WMS API                                 │
├─────────────────────────────────────────────────────────────┤
│  4. Verify WMS Backend                                      │
│     └── POST /products/sync → check barcode thật + cost/tax │
├─────────────────────────────────────────────────────────────┤
│  5. WMS Frontend                                            │
│     ├── 5.1 Thêm state + handler                            │
│     ├── 5.2 Thêm nút Sync                                   │
│     └── 5.3 (Optional) Thêm columns cost/tax                │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Cần Sửa (Summary)

| # | System | File | Thay đổi |
|---|--------|------|----------|
| 1 | PMI | `backend/alembic/versions/xxx.py` | Migration mới |
| 2 | PMI | `backend/models.py` | +2 columns ProductVariant |
| 3 | PMI | `backend/schemas/tier_variation.py` | +2 fields |
| 4 | PMI | `backend/routers/public.py` | +2 fields PublicVariantResponse |
| 5 | WMS | `backend/models.py` | +4 columns BarcodeMapping, +1 InboundItem |
| 6 | WMS | `backend/main.py` | +inline migration, rewrite sync endpoint |
| 7 | WMS | `backend/schemas.py` | +fields |
| 8 | WMS | `frontend/.../barcode-mappings/page.tsx` | +sync button, +columns |

---

## Notes

1. **Không có weighted average cost** như yêu cầu - chỉ track giá nhập per shipment
2. **Barcode collision**: Nếu 2 SKU khác nhau có cùng barcode → append `-{sku}` 
3. **Fallback logic**: Không có barcode từ PMI → dùng SKU làm barcode, type = "SKU"
4. **Pagination**: Sync tất cả products, không giới hạn 100
