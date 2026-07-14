# Test Plan: Giá Vốn, Thuế Suất và Sync Barcode

## 1. PMI Backend Tests

### 1.1 Unit Tests - Model & Schema

```python
# File: PMI/backend/tests/test_variant_cost_tax.py

import pytest
from decimal import Decimal
from schemas.tier_variation import ProductVariantBase, ProductVariantResponse

class TestProductVariantSchema:
    """Test new cost_price and tax_rate fields in variant schema"""
    
    def test_variant_with_cost_and_tax(self):
        """Variant với đầy đủ cost và tax"""
        data = {
            "price": Decimal("100000"),
            "stock": 10,
            "default_cost_price": Decimal("50000"),
            "default_tax_rate": Decimal("10.00")
        }
        variant = ProductVariantBase(**data)
        assert variant.default_cost_price == Decimal("50000")
        assert variant.default_tax_rate == Decimal("10.00")
    
    def test_variant_without_cost_tax_optional(self):
        """Cost và tax là optional"""
        data = {"price": Decimal("100000"), "stock": 10}
        variant = ProductVariantBase(**data)
        assert variant.default_cost_price is None
        assert variant.default_tax_rate is None
    
    def test_cost_price_must_be_non_negative(self):
        """Cost price không được âm"""
        with pytest.raises(ValueError):
            ProductVariantBase(
                price=Decimal("100000"),
                stock=10,
                default_cost_price=Decimal("-1000")
            )
    
    def test_tax_rate_must_be_0_to_100(self):
        """Tax rate phải từ 0-100%"""
        with pytest.raises(ValueError):
            ProductVariantBase(
                price=Decimal("100000"),
                stock=10,
                default_tax_rate=Decimal("150")  # Invalid
            )
```

### 1.2 Integration Tests - API Endpoints

```python
# File: PMI/backend/tests/test_product_api_cost_tax.py

import pytest
from fastapi.testclient import TestClient

class TestProductAPIWithCostTax:
    """Test product CRUD với cost/tax fields"""
    
    def test_create_product_with_cost_tax(self, client: TestClient, auth_headers):
        """Tạo product với variant có cost và tax"""
        payload = {
            "name": "Test Product",
            "product_code": "TEST-001",
            "weight": 100,
            "variants": [{
                "sku_code": "TEST-001-RED",
                "price": 100000,
                "stock": 10,
                "barcode": "8934567890123",
                "default_cost_price": 50000,
                "default_tax_rate": 10
            }]
        }
        res = client.post("/products", json=payload, headers=auth_headers)
        assert res.status_code == 201
        data = res.json()
        variant = data["variants"][0]
        assert variant["default_cost_price"] == 50000
        assert variant["default_tax_rate"] == 10
    
    def test_update_variant_cost_tax(self, client: TestClient, auth_headers, sample_product):
        """Update cost/tax của variant"""
        payload = {
            "variants": [{
                "id": sample_product["variants"][0]["id"],
                "sku_code": sample_product["variants"][0]["sku_code"],
                "price": 100000,
                "stock": 10,
                "default_cost_price": 60000,  # Updated
                "default_tax_rate": 8         # Updated
            }]
        }
        res = client.put(f"/products/{sample_product['id']}", json=payload, headers=auth_headers)
        assert res.status_code == 200
        variant = res.json()["variants"][0]
        assert variant["default_cost_price"] == 60000
        assert variant["default_tax_rate"] == 8
    
    def test_public_api_returns_cost_tax(self, client: TestClient, sample_product_with_cost):
        """Public API trả về cost/tax cho WMS sync"""
        res = client.get("/public/products")
        assert res.status_code == 200
        products = res.json()["items"]
        
        # Find our test product
        product = next(p for p in products if p["id"] == sample_product_with_cost["id"])
        variant = product["variants"][0]
        
        assert "default_cost_price" in variant
        assert "default_tax_rate" in variant
        assert variant["default_cost_price"] == 50000
        assert variant["default_tax_rate"] == 10
```

---

## 2. WMS Backend Tests

### 2.1 Unit Tests - Model

```python
# File: WMS/backend/tests/test_barcode_mapping_model.py

import pytest
from models import BarcodeMapping, InboundItem
from decimal import Decimal
from datetime import datetime

class TestBarcodeMappingModel:
    """Test BarcodeMapping với cost/tax fields mới"""
    
    def test_create_barcode_mapping_with_cost_tax(self, db_session):
        """Tạo BarcodeMapping với cost và tax"""
        bm = BarcodeMapping(
            barcode="8934567890123",
            barcode_type="EAN-13",
            sku_code="TEST-001-RED",
            product_name="Test Product",
            variant_name="Red",
            cost_price=Decimal("50000"),
            tax_rate=Decimal("10.00"),
            pmi_variant_id=123,
            last_synced_at=datetime.utcnow()
        )
        db_session.add(bm)
        db_session.commit()
        
        saved = db_session.query(BarcodeMapping).filter_by(sku_code="TEST-001-RED").first()
        assert saved.cost_price == Decimal("50000")
        assert saved.tax_rate == Decimal("10.00")
        assert saved.pmi_variant_id == 123
        assert saved.last_synced_at is not None

class TestInboundItemModel:
    """Test InboundItem với unit_cost field mới"""
    
    def test_create_inbound_item_with_unit_cost(self, db_session, sample_inbound_shipment):
        """Tạo InboundItem với unit_cost"""
        item = InboundItem(
            inbound_shipment_id=sample_inbound_shipment.id,
            sku_code="TEST-001-RED",
            product_name="Test Product",
            expected_qty=100,
            unit_cost=Decimal("48000")  # Giá nhập thực tế
        )
        db_session.add(item)
        db_session.commit()
        
        saved = db_session.query(InboundItem).filter_by(sku_code="TEST-001-RED").first()
        assert saved.unit_cost == Decimal("48000")
```

### 2.2 Integration Tests - Sync Endpoint

```python
# File: WMS/backend/tests/test_sync_endpoint.py

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import json

class TestProductSyncEndpoint:
    """Test sync endpoint với PMI"""
    
    @pytest.fixture
    def mock_pmi_response(self):
        """Mock response từ PMI API"""
        return {
            "items": [
                {
                    "id": 1,
                    "name": "Áo Thun Nam",
                    "media": [{"image_url": "http://example.com/img.jpg", "is_cover": True}],
                    "variants": [
                        {
                            "id": 101,
                            "sku_code": "ATN-001-RED-M",
                            "tier_1_option": "Đỏ",
                            "tier_2_option": "M",
                            "barcode": "8934567890123",
                            "default_cost_price": 50000,
                            "default_tax_rate": 10
                        },
                        {
                            "id": 102,
                            "sku_code": "ATN-001-BLUE-M",
                            "tier_1_option": "Xanh",
                            "tier_2_option": "M",
                            "barcode": None,  # No barcode - should fallback to SKU
                            "default_cost_price": 50000,
                            "default_tax_rate": 10
                        }
                    ]
                }
            ],
            "pages": 1,
            "total": 1
        }
    
    def test_sync_creates_barcode_mappings(self, client: TestClient, mock_pmi_response):
        """Sync tạo BarcodeMapping từ PMI data"""
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_response = MagicMock()
            mock_response.read.return_value = json.dumps(mock_pmi_response).encode()
            mock_response.__enter__ = lambda s: s
            mock_response.__exit__ = MagicMock()
            mock_urlopen.return_value = mock_response
            
            res = client.post("/products/sync")
            assert res.status_code == 200
            
            data = res.json()
            assert data["status"] == "success"
            assert data["synced_count"] == 2
            assert data["created_count"] == 2
    
    def test_sync_uses_real_barcode_from_pmi(self, client: TestClient, db_session, mock_pmi_response):
        """Sync dùng barcode thật từ PMI, không fake"""
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_response = MagicMock()
            mock_response.read.return_value = json.dumps(mock_pmi_response).encode()
            mock_response.__enter__ = lambda s: s
            mock_response.__exit__ = MagicMock()
            mock_urlopen.return_value = mock_response
            
            client.post("/products/sync")
            
            # Check barcode thật được dùng
            from models import BarcodeMapping
            bm1 = db_session.query(BarcodeMapping).filter_by(sku_code="ATN-001-RED-M").first()
            assert bm1.barcode == "8934567890123"  # Real barcode from PMI
            assert bm1.barcode_type == "EAN-13"
            
            # Check fallback to SKU khi không có barcode
            bm2 = db_session.query(BarcodeMapping).filter_by(sku_code="ATN-001-BLUE-M").first()
            assert bm2.barcode == "ATN-001-BLUE-M"  # Fallback to SKU
            assert bm2.barcode_type == "SKU"
    
    def test_sync_caches_cost_and_tax(self, client: TestClient, db_session, mock_pmi_response):
        """Sync cache cost_price và tax_rate từ PMI"""
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_response = MagicMock()
            mock_response.read.return_value = json.dumps(mock_pmi_response).encode()
            mock_response.__enter__ = lambda s: s
            mock_response.__exit__ = MagicMock()
            mock_urlopen.return_value = mock_response
            
            client.post("/products/sync")
            
            from models import BarcodeMapping
            bm = db_session.query(BarcodeMapping).filter_by(sku_code="ATN-001-RED-M").first()
            assert bm.cost_price == 50000
            assert bm.tax_rate == 10
            assert bm.pmi_variant_id == 101
            assert bm.last_synced_at is not None
    
    def test_sync_updates_existing_mappings(self, client: TestClient, db_session, mock_pmi_response):
        """Sync cập nhật mapping đã tồn tại"""
        # Create existing mapping
        from models import BarcodeMapping
        existing = BarcodeMapping(
            barcode="OLD-BARCODE",
            barcode_type="SKU",
            sku_code="ATN-001-RED-M",
            product_name="Old Name",
            cost_price=40000
        )
        db_session.add(existing)
        db_session.commit()
        
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_response = MagicMock()
            mock_response.read.return_value = json.dumps(mock_pmi_response).encode()
            mock_response.__enter__ = lambda s: s
            mock_response.__exit__ = MagicMock()
            mock_urlopen.return_value = mock_response
            
            res = client.post("/products/sync")
            data = res.json()
            assert data["updated_count"] == 1  # Existing one updated
            assert data["created_count"] == 1  # New one created
            
            # Verify update
            db_session.refresh(existing)
            assert existing.barcode == "8934567890123"  # Updated to real barcode
            assert existing.product_name == "Áo Thun Nam"
            assert existing.cost_price == 50000
    
    def test_sync_handles_barcode_collision(self, client: TestClient, db_session):
        """Sync xử lý trường hợp barcode trùng"""
        # Create existing mapping with same barcode but different SKU
        from models import BarcodeMapping
        existing = BarcodeMapping(
            barcode="8934567890123",
            sku_code="DIFFERENT-SKU",
            product_name="Different Product"
        )
        db_session.add(existing)
        db_session.commit()
        
        mock_response = {
            "items": [{
                "id": 1,
                "name": "New Product",
                "media": [],
                "variants": [{
                    "id": 201,
                    "sku_code": "NEW-SKU",
                    "barcode": "8934567890123",  # Same barcode!
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
            
            client.post("/products/sync")
            
            # New mapping should have modified barcode
            new_bm = db_session.query(BarcodeMapping).filter_by(sku_code="NEW-SKU").first()
            assert new_bm.barcode == "8934567890123-NEW-SKU"  # Appended SKU
    
    def test_sync_pagination(self, client: TestClient):
        """Sync xử lý pagination khi có nhiều products"""
        page1 = {"items": [{"id": 1, "name": "P1", "media": [], "variants": [
            {"id": 1, "sku_code": "SKU-1", "barcode": None}
        ]}], "pages": 2, "total": 2}
        
        page2 = {"items": [{"id": 2, "name": "P2", "media": [], "variants": [
            {"id": 2, "sku_code": "SKU-2", "barcode": None}
        ]}], "pages": 2, "total": 2}
        
        call_count = [0]
        def mock_urlopen_side_effect(req, **kwargs):
            call_count[0] += 1
            mock_resp = MagicMock()
            data = page1 if call_count[0] == 1 else page2
            mock_resp.read.return_value = json.dumps(data).encode()
            mock_resp.__enter__ = lambda s: s
            mock_resp.__exit__ = MagicMock()
            return mock_resp
        
        with patch("urllib.request.urlopen", side_effect=mock_urlopen_side_effect):
            res = client.post("/products/sync")
            data = res.json()
            assert data["synced_count"] == 2
            assert data["pages_processed"] == 2
```

---

## 3. WMS Frontend Tests

### 3.1 Component Tests

```typescript
// File: WMS/frontend/src/app/(desktop)/barcode-mappings/__tests__/page.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BarcodeMappingsPage from '../page';

describe('BarcodeMappingsPage', () => {
  describe('Sync Button', () => {
    it('renders sync button', () => {
      render(<BarcodeMappingsPage />);
      expect(screen.getByText('Đồng bộ từ PMI')).toBeInTheDocument();
    });

    it('shows confirm dialog when clicked', async () => {
      render(<BarcodeMappingsPage />);
      fireEvent.click(screen.getByText('Đồng bộ từ PMI'));
      
      await waitFor(() => {
        expect(screen.getByText(/Bạn có chắc muốn đồng bộ/)).toBeInTheDocument();
      });
    });

    it('shows spinner while syncing', async () => {
      global.fetch = jest.fn(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ synced_count: 10 })
        }), 1000))
      );

      render(<BarcodeMappingsPage />);
      fireEvent.click(screen.getByText('Đồng bộ từ PMI'));
      fireEvent.click(screen.getByText('Xác nhận')); // Confirm dialog

      await waitFor(() => {
        expect(screen.getByText('Đang đồng bộ...')).toBeInTheDocument();
      });
    });

    it('shows success message after sync', async () => {
      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          synced_count: 50, 
          created_count: 10, 
          updated_count: 40 
        })
      }));

      render(<BarcodeMappingsPage />);
      fireEvent.click(screen.getByText('Đồng bộ từ PMI'));
      fireEvent.click(screen.getByText('Xác nhận'));

      await waitFor(() => {
        expect(screen.getByText(/Đồng bộ thành công/)).toBeInTheDocument();
        expect(screen.getByText(/50 sản phẩm/)).toBeInTheDocument();
      });
    });

    it('shows error message on failure', async () => {
      global.fetch = jest.fn(() => Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ detail: 'Không thể kết nối đến PMI' })
      }));

      render(<BarcodeMappingsPage />);
      fireEvent.click(screen.getByText('Đồng bộ từ PMI'));
      fireEvent.click(screen.getByText('Xác nhận'));

      await waitFor(() => {
        expect(screen.getByText(/Không thể kết nối đến PMI/)).toBeInTheDocument();
      });
    });
  });

  describe('Cost/Tax Columns', () => {
    it('displays cost_price column', async () => {
      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, sku_code: 'SKU-1', cost_price: 50000, tax_rate: 10 }
        ])
      }));

      render(<BarcodeMappingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Giá vốn')).toBeInTheDocument();
        expect(screen.getByText('50,000đ')).toBeInTheDocument();
      });
    });

    it('displays tax_rate column', async () => {
      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, sku_code: 'SKU-1', tax_rate: 10 }
        ])
      }));

      render(<BarcodeMappingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Thuế')).toBeInTheDocument();
        expect(screen.getByText('10%')).toBeInTheDocument();
      });
    });

    it('shows dash when cost/tax is null', async () => {
      global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, sku_code: 'SKU-1', cost_price: null, tax_rate: null }
        ])
      }));

      render(<BarcodeMappingsPage />);

      await waitFor(() => {
        // Both columns should show "-"
        expect(screen.getAllByText('-')).toHaveLength(2);
      });
    });
  });
});
```

---

## 4. E2E Tests

### 4.1 Full Flow Test

```python
# File: e2e_tests/test_cost_tax_sync_flow.py

import pytest
from playwright.sync_api import Page, expect

class TestCostTaxSyncE2E:
    """E2E test cho toàn bộ flow cost/tax sync"""
    
    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        self.page = page
        self.pmi_url = "http://localhost:13100"
        self.wms_url = "http://localhost:13102"
    
    def test_full_flow_pmi_to_wms(self):
        """Test full flow: PMI create product -> WMS sync -> verify data"""
        
        # Step 1: Login PMI
        self.page.goto(f"{self.pmi_url}/login")
        self.page.fill('[name="email"]', "admin@test.com")
        self.page.fill('[name="password"]', "password")
        self.page.click('button[type="submit"]')
        self.page.wait_for_url("**/products**")
        
        # Step 2: Create product với cost và tax
        self.page.click('text=Thêm sản phẩm')
        self.page.fill('[name="name"]', "E2E Test Product")
        self.page.fill('[name="product_code"]', "E2E-TEST-001")
        self.page.fill('[name="weight"]', "100")
        
        # Add variant với cost/tax
        self.page.fill('[name="variants.0.sku_code"]', "E2E-TEST-001-VAR")
        self.page.fill('[name="variants.0.price"]', "100000")
        self.page.fill('[name="variants.0.stock"]', "50")
        self.page.fill('[name="variants.0.barcode"]', "8934567890999")
        self.page.fill('[name="variants.0.default_cost_price"]', "50000")
        self.page.fill('[name="variants.0.default_tax_rate"]', "10")
        
        self.page.click('text=Lưu')
        expect(self.page.locator('text=Tạo sản phẩm thành công')).to_be_visible()
        
        # Step 3: Go to WMS barcode mappings
        self.page.goto(f"{self.wms_url}/barcode-mappings")
        
        # Step 4: Click sync button
        self.page.click('text=Đồng bộ từ PMI')
        self.page.click('text=Xác nhận')  # Confirm dialog
        
        # Wait for sync complete
        expect(self.page.locator('text=Đồng bộ thành công')).to_be_visible(timeout=30000)
        
        # Step 5: Verify data in table
        row = self.page.locator('tr:has-text("E2E-TEST-001-VAR")')
        expect(row).to_be_visible()
        
        # Check barcode is real (not BAR-xxx)
        expect(row.locator('text=8934567890999')).to_be_visible()
        
        # Check cost price
        expect(row.locator('text=50,000đ')).to_be_visible()
        
        # Check tax rate
        expect(row.locator('text=10%')).to_be_visible()
    
    def test_inbound_with_unit_cost(self):
        """Test tạo inbound shipment với unit_cost"""
        
        # Login WMS
        self.page.goto(f"{self.wms_url}/login")
        # ... login steps
        
        # Go to inbound
        self.page.goto(f"{self.wms_url}/inbound")
        self.page.click('text=Tạo phiếu nhập')
        
        # Fill inbound details
        self.page.fill('[name="supplier_name"]', "NCC Test")
        
        # Add item với unit_cost
        self.page.click('text=Thêm sản phẩm')
        self.page.fill('[name="items.0.sku_code"]', "E2E-TEST-001-VAR")
        self.page.fill('[name="items.0.expected_qty"]', "100")
        self.page.fill('[name="items.0.unit_cost"]', "48000")  # Giá nhập thực tế
        
        self.page.click('text=Lưu')
        expect(self.page.locator('text=Tạo phiếu nhập thành công')).to_be_visible()
        
        # Verify unit_cost saved
        self.page.click('text=E2E-TEST-001-VAR')
        expect(self.page.locator('text=48,000đ')).to_be_visible()
```

---

## 5. Test Commands

```bash
# PMI Backend Tests
docker compose -f PMI/docker-compose.yml exec api pytest tests/test_variant_cost_tax.py -v
docker compose -f PMI/docker-compose.yml exec api pytest tests/test_product_api_cost_tax.py -v

# WMS Backend Tests  
docker compose -f WMS/docker-compose.yml exec api pytest tests/test_barcode_mapping_model.py -v
docker compose -f WMS/docker-compose.yml exec api pytest tests/test_sync_endpoint.py -v

# WMS Frontend Tests
docker compose -f WMS/docker-compose.yml exec frontend npm run test -- --testPathPattern="barcode-mappings"

# E2E Tests (cần start all services trước)
./start_all.sh --no-build
pytest e2e_tests/test_cost_tax_sync_flow.py -v
```

---

## 6. Manual Test Checklist

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | PMI: Tạo product với cost/tax | Tạo product, nhập cost=50000, tax=10 | Lưu thành công, hiển thị đúng |
| 2 | PMI: Public API trả cost/tax | GET /public/products | Response có default_cost_price, default_tax_rate |
| 3 | WMS: Nút sync hiển thị | Vào trang Barcode Mappings | Thấy nút "Đồng bộ từ PMI" |
| 4 | WMS: Sync confirm dialog | Click nút sync | Hiện dialog xác nhận |
| 5 | WMS: Sync spinner | Xác nhận sync | Nút disabled + spinner quay |
| 6 | WMS: Sync success | Đợi sync xong | Alert hiện count tạo/update |
| 7 | WMS: Barcode thật | Sau sync, check table | Barcode = barcode từ PMI (không phải BAR-xxx) |
| 8 | WMS: Cost/tax cached | Sau sync, check table | Cột Giá vốn và Thuế hiển thị đúng |
| 9 | WMS: Fallback SKU | Sync product không có barcode | barcode = SKU, type = "SKU" |
| 10 | WMS: Inbound với unit_cost | Tạo inbound, nhập unit_cost | Lưu và hiển thị đúng |

---

## 7. Regression Tests

Đảm bảo các chức năng cũ không bị ảnh hưởng:

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | PMI: Tạo product KHÔNG có cost/tax | Vẫn tạo được, fields = null |
| 2 | PMI: Update product cũ | Vẫn update được, không lỗi |
| 3 | WMS: Barcode lookup | Scan barcode vẫn hoạt động |
| 4 | WMS: Inbound flow | Tạo inbound KHÔNG có unit_cost vẫn OK |
| 5 | WMS: Fulfillment flow | Pick/Pack/Ship vẫn hoạt động |
