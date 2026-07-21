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
            assert data["deleted_count"] == 0
    
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
            assert data["deleted_count"] == 0
            
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
                        "sku_code": "DIFFERENT-SKU",  # Keep existing SKU
                        "barcode": "8934567890123",  # Same barcode
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
            assert data["deleted_count"] == 0

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
