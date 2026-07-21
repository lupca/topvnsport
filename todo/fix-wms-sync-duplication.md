# Task: Fix WMS Product Sync Duplication

## Problem

Chức năng đồng bộ sản phẩm từ PMI sang WMS (`sync_products_from_pmi`) có 2 lỗi:

1. **Không có unique constraint trên `sku_code`**: Cho phép duplicate SKU trong database
2. **Không xóa sản phẩm đã bị xóa ở PMI**: Sync chỉ tạo/cập nhật, không xóa

## Files cần sửa

- `WMS/backend/models.py:66` - Thêm `unique=True` cho `sku_code`
- `WMS/backend/routers/barcode_mappings.py:79-237` - Thêm logic hard-delete

## Steps

### 1. Thêm unique constraint trong model

**File:** `WMS/backend/models.py`

Sửa dòng 66 từ:
```python
sku_code = Column(String, nullable=False, index=True)
```

Thành:
```python
sku_code = Column(String, unique=True, nullable=False, index=True)
```

### 2. Tạo Alembic migration

```bash
cd WMS/backend
alembic revision --autogenerate -m "add unique constraint to barcode_mapping sku_code"
```

**Lưu ý:** Trong migration file, thêm logic xóa duplicates TRƯỚC khi thêm constraint:

```python
def upgrade():
    # Xóa duplicates trước (giữ record mới nhất)
    op.execute("""
        DELETE FROM barcode_mapping 
        WHERE id NOT IN (
            SELECT MAX(id) FROM barcode_mapping GROUP BY sku_code
        )
    """)
    # Thêm unique constraint
    op.create_unique_constraint('uq_barcode_mapping_sku_code', 'barcode_mapping', ['sku_code'])
```

### 3. Cập nhật sync logic để hard-delete

**File:** `WMS/backend/routers/barcode_mappings.py`

Trong function `sync_products_from_pmi`:

1. Thêm biến track SKU đã sync (đầu function, sau dòng 117):
```python
synced_skus = set()
```

2. Trong vòng lặp, sau khi xử lý variant (sau dòng 221):
```python
synced_skus.add(sku)
```

3. Sau vòng lặp while, trước `db.commit()` (trước dòng 228):
```python
# Hard-delete records không còn trong PMI
deleted_count = 0
for existing_sku, bm in list(existing_mappings.items()):
    if existing_sku not in synced_skus:
        db.delete(bm)
        deleted_count += 1
        logger.info(f"Deleted orphan mapping: {existing_sku}")
```

4. Cập nhật return statement (dòng 230-237):
```python
return {
    "status": "success",
    "message": f"Đồng bộ thành công {synced_count} sản phẩm, xóa {deleted_count} sản phẩm",
    "synced_count": synced_count,
    "created_count": created_count,
    "updated_count": updated_count,
    "deleted_count": deleted_count,
    "pages_processed": page
}
```

### 4. Chạy migration

```bash
cd WMS/backend
alembic upgrade head
```

### 5. Cập nhật existing tests và thêm tests mới

**File:** `WMS/backend/tests/test_sync_endpoint.py`

#### 5.1 Sửa `test_sync_handles_barcode_collision` (dòng 133-172)

Test hiện tại tạo mapping `DIFFERENT-SKU` không có trong PMI response → sẽ bị xóa sau khi thêm delete logic.

Sửa mock_response để include cả `DIFFERENT-SKU`:

```python
def test_sync_handles_barcode_collision(self, client: TestClient, db_session):
    """Sync xử lý trường hợp barcode trùng"""
    from models import BarcodeMapping
    existing = BarcodeMapping(
        barcode="8934567890123",
        sku_code="DIFFERENT-SKU",
        product_name="Different Product"
    )
    db_session.add(existing)
    db_session.commit()
    
    # PMI response có cả DIFFERENT-SKU (để không bị xóa) và NEW-SKU (barcode trùng)
    mock_response = {
        "items": [
            {
                "id": 1,
                "name": "New Product",
                "media": [],
                "variants": [{
                    "id": 201,
                    "sku_code": "NEW-SKU",
                    "barcode": "8934567890123",  # Same barcode as existing!
                    "default_cost_price": 50000,
                    "default_tax_rate": 10
                }]
            },
            {
                "id": 2,
                "name": "Different Product Updated",
                "media": [],
                "variants": [{
                    "id": 202,
                    "sku_code": "DIFFERENT-SKU",  # Giữ lại existing
                    "barcode": "8934567890123",  # Cùng barcode
                    "default_cost_price": 60000,
                    "default_tax_rate": 10
                }]
            }
        ],
        "pages": 1
    }
    
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_response).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock()
        mock_urlopen.return_value = mock_resp
        
        res = client.post("/products/sync")
        data = res.json()
        assert data["deleted_count"] == 0
        
        # New mapping should have modified barcode (collision với existing)
        new_bm = db_session.query(BarcodeMapping).filter_by(sku_code="NEW-SKU").first()
        assert new_bm.barcode == "8934567890123-NEW-SKU"
```

#### 5.2 Thêm assertion `deleted_count` vào các test hiện có

**`test_sync_creates_barcode_mappings`** - thêm sau dòng 59:
```python
assert data["deleted_count"] == 0
```

**`test_sync_updates_existing_mappings`** - thêm sau dòng 125:
```python
assert data["deleted_count"] == 0
```

**`test_sync_pagination`** - thêm sau dòng 198:
```python
assert data["deleted_count"] == 0
```

#### 5.3 Thêm 2 test cases mới:

```python
def test_sync_deletes_orphan_mappings(self, client: TestClient, db_session):
    """Sync xóa mapping không còn trong PMI"""
    from models import BarcodeMapping
    
    # Tạo mapping "cũ" sẽ bị xóa vì không có trong PMI response
    orphan = BarcodeMapping(
        barcode="ORPHAN-123",
        barcode_type="SKU",
        sku_code="ORPHAN-SKU",
        product_name="Sản phẩm đã xóa ở PMI"
    )
    db_session.add(orphan)
    db_session.commit()
    orphan_id = orphan.id
    
    # PMI response không chứa ORPHAN-SKU
    mock_response = {
        "items": [{
            "id": 1,
            "name": "Active Product",
            "media": [],
            "variants": [{
                "id": 101,
                "sku_code": "ACTIVE-SKU",
                "barcode": None,
                "default_cost_price": 50000,
                "default_tax_rate": 10
            }]
        }],
        "pages": 1
    }
    
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_response).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock()
        mock_urlopen.return_value = mock_resp
        
        res = client.post("/products/sync")
        data = res.json()
        
        assert data["deleted_count"] == 1
        assert data["created_count"] == 1
        
        # Verify orphan đã bị xóa
        assert db_session.query(BarcodeMapping).filter_by(id=orphan_id).first() is None
        # Verify active vẫn còn
        assert db_session.query(BarcodeMapping).filter_by(sku_code="ACTIVE-SKU").first() is not None


def test_sync_prevents_duplicate_sku(self, client: TestClient, db_session):
    """Sync không tạo duplicate SKU"""
    from models import BarcodeMapping
    
    mock_response = {
        "items": [{
            "id": 1,
            "name": "Product",
            "media": [],
            "variants": [{
                "id": 101,
                "sku_code": "SAME-SKU",
                "barcode": "111",
                "default_cost_price": 50000,
                "default_tax_rate": 10
            }]
        }],
        "pages": 1
    }
    
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_response).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock()
        mock_urlopen.return_value = mock_resp
        
        # Sync 2 lần
        client.post("/products/sync")
        client.post("/products/sync")
        
        # Chỉ có 1 record
        count = db_session.query(BarcodeMapping).filter_by(sku_code="SAME-SKU").count()
        assert count == 1
```

## Verification

Chạy tất cả tests:
```bash
docker compose -f WMS/docker-compose.yml exec api pytest tests/test_sync_endpoint.py -v
```
