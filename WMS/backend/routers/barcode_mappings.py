from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import urllib.request
import json
import os
import logging
from datetime import datetime

from database import get_db
import models
import schemas

logger = logging.getLogger("wms_backend.barcode_mappings")
router = APIRouter(tags=['Barcode Mappings'])

@router.get("/barcode-mappings", response_model=List[schemas.BarcodeMappingResponse])
def list_barcode_mappings(db: Session = Depends(get_db)):
    return db.query(models.BarcodeMapping).all()

@router.get("/barcode-mappings/lookup/{barcode}", response_model=schemas.BarcodeMappingResponse)
def lookup_barcode_mapping_by_barcode(barcode: str, db: Session = Depends(get_db)):
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == barcode).first()
    if not bm:
        raise HTTPException(status_code=404, detail="Barcode mapping not found")
    return bm

@router.get("/barcode-mappings/{barcode}", response_model=schemas.BarcodeMappingResponse)
def lookup_barcode_mapping(barcode: str, db: Session = Depends(get_db)):
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == barcode).first()
    if not bm:
        raise HTTPException(status_code=404, detail="Barcode mapping not found")
    return bm

@router.post("/barcode-mappings", response_model=schemas.BarcodeMappingResponse, status_code=201)
def create_barcode_mapping(payload: schemas.BarcodeMappingCreate, db: Session = Depends(get_db)):
    # Check duplicate barcode
    dup = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == payload.barcode).first()
    if dup:
        raise HTTPException(status_code=400, detail="Barcode already mapped")
    bm = models.BarcodeMapping(
        barcode=payload.barcode,
        barcode_type=payload.barcode_type,
        sku_code=payload.sku_code,
        product_name=payload.product_name,
        variant_name=payload.variant_name,
        image_url=payload.image_url
    )
    db.add(bm)
    db.commit()
    db.refresh(bm)
    return bm

@router.put("/barcode-mappings/{id}", response_model=schemas.BarcodeMappingResponse)
def update_barcode_mapping(id: int, payload: schemas.BarcodeMappingCreate, db: Session = Depends(get_db)):
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.id == id).first()
    if not bm:
        raise HTTPException(status_code=404, detail="Barcode mapping not found")
    bm.barcode = payload.barcode
    bm.barcode_type = payload.barcode_type
    bm.sku_code = payload.sku_code
    bm.product_name = payload.product_name
    bm.variant_name = payload.variant_name
    bm.image_url = payload.image_url
    db.commit()
    db.refresh(bm)
    return bm

@router.delete("/barcode-mappings/{id}", status_code=204)
def delete_barcode_mapping(id: int, db: Session = Depends(get_db)):
    bm = db.query(models.BarcodeMapping).filter(models.BarcodeMapping.id == id).first()
    if not bm:
        raise HTTPException(status_code=404, detail="Barcode mapping not found")
    db.delete(bm)
    db.commit()
    return None

@router.post("/products/sync")
def sync_products_from_pmi(db: Session = Depends(get_db)):
    """
    Đồng bộ tất cả sản phẩm từ PMI sang WMS BarcodeMapping.
    """
    # Resolve working PMI base URL (checking env vars first, falling back to local defaults)
    candidate_urls = []
    for env_var in ["PMI_API_URL", "PIM_API_URL", "PMI_URL", "E2E_PMI_API_URL"]:
        val = os.getenv(env_var)
        if val and val not in candidate_urls:
            candidate_urls.append(val)
    for default_url in ["http://pim-api:8000", "http://localhost:18100", "http://127.0.0.1:18100"]:
        if default_url not in candidate_urls:
            candidate_urls.append(default_url)

    working_base_url = None
    for url in candidate_urls:
        try:
            test_req = urllib.request.Request(f"{url}/public/products?page=1&limit=1", method="GET")
            with urllib.request.urlopen(test_req, timeout=2) as resp:
                if resp.status in (200, 201):
                    working_base_url = url
                    break
        except Exception:
            continue

    if not working_base_url:
        pmi_base_url = os.getenv("PMI_API_URL", os.getenv("PIM_API_URL", os.getenv("PMI_URL", os.getenv("E2E_PMI_API_URL", "http://localhost:18100"))))
    else:
        pmi_base_url = working_base_url

    synced_count = 0
    created_count = 0
    updated_count = 0
    page = 1
    limit = 100
    
    # Prefetch all existing mappings to avoid N+1 query problem
    existing_mappings = {bm.sku_code: bm for bm in db.query(models.BarcodeMapping).all()}
    existing_barcodes = {bm.barcode: bm.sku_code for bm in db.query(models.BarcodeMapping).all()}
    
    while True:
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
                pmi_barcode = var.get("barcode")
                if pmi_barcode and pmi_barcode.strip():
                    barcode = pmi_barcode.strip()
                    barcode_type = "EAN-13"
                else:
                    barcode = sku
                    barcode_type = "SKU"
                
                cost_price = var.get("default_cost_price")
                tax_rate = var.get("default_tax_rate")
                pmi_variant_id = var.get("id")
                selling_price = var.get("price")
                
                parts = []
                if var.get("tier_1_option"):
                    parts.append(var.get("tier_1_option"))
                if var.get("tier_2_option"):
                    parts.append(var.get("tier_2_option"))
                variant_name = " / ".join(parts) if parts else "Standard"
                
                image_url = None
                media = prod.get("media", [])
                if media:
                    cover = next((m for m in media if m.get("is_cover")), None)
                    image_url = (cover or media[0]).get("image_url")
                
                # === Upsert by sku_code ===
                existing = existing_mappings.get(sku)
                
                if not existing:
                    while (barcode in existing_barcodes and existing_barcodes[barcode] != sku) or db.query(models.BarcodeMapping).filter(models.BarcodeMapping.barcode == barcode, models.BarcodeMapping.sku_code != sku).first():
                        barcode = f"{barcode}-{sku}"
                        logger.warning(f"Barcode collision detected, using: {barcode}")
                    
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
                        last_synced_at=datetime.utcnow(),
                        selling_price=selling_price
                    )
                    db.add(bm)
                    
                    existing_mappings[sku] = bm
                    existing_barcodes[barcode] = sku
                    created_count += 1
                else:
                    if pmi_barcode and pmi_barcode.strip():
                        old_barcode = existing.barcode
                        new_barcode = pmi_barcode.strip()
                        if new_barcode != old_barcode:
                            colliding_sku = existing_barcodes.get(new_barcode)
                            if colliding_sku and colliding_sku != sku:
                                new_barcode = f"{new_barcode}-{sku}"
                                logger.warning(f"Barcode collision detected on update, using: {new_barcode}")
                        existing.barcode = new_barcode
                        existing.barcode_type = "EAN-13"
                        if old_barcode in existing_barcodes:
                            del existing_barcodes[old_barcode]
                        existing_barcodes[new_barcode] = sku
                    
                    existing.product_name = prod.get("name", "")
                    existing.variant_name = variant_name
                    existing.image_url = image_url
                    existing.cost_price = cost_price
                    existing.tax_rate = tax_rate
                    existing.pmi_variant_id = pmi_variant_id
                    existing.last_synced_at = datetime.utcnow()
                    existing.selling_price = selling_price
                    updated_count += 1
                
                synced_count += 1
        
        logger.info(f"Synced page {page}/{total_pages}, products so far: {synced_count}")
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
