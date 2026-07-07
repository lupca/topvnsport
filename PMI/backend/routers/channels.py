import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload
from database import get_db
import models
import schemas

router = APIRouter(
    prefix="/api",
    tags=["channels"]
)

# Channel Endpoints
@router.get("/channels", response_model=List[schemas.ChannelResponse])
def get_channels(db: Session = Depends(get_db)):
    return db.query(models.Channel).all()

@router.post("/channels", response_model=schemas.ChannelResponse, status_code=status.HTTP_201_CREATED)
def create_channel(channel: schemas.ChannelCreate, db: Session = Depends(get_db)):
    db_chan = db.query(models.Channel).filter(models.Channel.code == channel.code).first()
    if db_chan:
        raise HTTPException(status_code=400, detail="Channel code already exists.")
    new_chan = models.Channel(code=channel.code, name=channel.name)
    db.add(new_chan)
    db.commit()
    db.refresh(new_chan)
    return new_chan

@router.get("/channels/{channel_id}", response_model=schemas.ChannelResponse)
def get_channel(channel_id: int, db: Session = Depends(get_db)):
    chan = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not chan:
        raise HTTPException(status_code=404, detail="Channel not found")
    return chan

@router.put("/channels/{channel_id}", response_model=schemas.ChannelResponse)
def update_channel(channel_id: int, channel_in: schemas.ChannelUpdate, db: Session = Depends(get_db)):
    chan = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not chan:
        raise HTTPException(status_code=404, detail="Channel not found")
    dup = db.query(models.Channel).filter(models.Channel.code == channel_in.code, models.Channel.id != channel_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Channel code already exists.")
    chan.code = channel_in.code
    chan.name = channel_in.name
    db.commit()
    db.refresh(chan)
    return chan

@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_channel(channel_id: int, db: Session = Depends(get_db)):
    chan = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not chan:
        raise HTTPException(status_code=404, detail="Channel not found")
    listing_exists = db.query(models.ProductChannelListing).filter(models.ProductChannelListing.channel_id == channel_id).first()
    if listing_exists:
        raise HTTPException(status_code=400, detail="Cannot delete channel with active listings.")
    db.delete(chan)
    db.commit()

# Config Endpoints
@router.get("/channels/{channel_id}/config", response_model=schemas.ChannelConfigResponse)
def get_channel_config(channel_id: int, db: Session = Depends(get_db)):
    chan = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not chan:
        raise HTTPException(status_code=404, detail="Channel not found")
    conf = db.query(models.ChannelConfig).filter(models.ChannelConfig.channel_id == channel_id).first()
    if not conf:
        conf = models.ChannelConfig(channel_id=channel_id, is_active=True)
        db.add(conf)
        db.commit()
        db.refresh(conf)
    return conf

@router.put("/channels/{channel_id}/config", response_model=schemas.ChannelConfigResponse)
def update_channel_config(channel_id: int, config_in: schemas.ChannelConfigUpdate, db: Session = Depends(get_db)):
    chan = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not chan:
        raise HTTPException(status_code=404, detail="Channel not found")
    conf = db.query(models.ChannelConfig).filter(models.ChannelConfig.channel_id == channel_id).first()
    if not conf:
        conf = models.ChannelConfig(channel_id=channel_id)
        db.add(conf)
    conf.app_key = config_in.app_key
    conf.app_secret = config_in.app_secret
    conf.access_token = config_in.access_token
    conf.refresh_token = config_in.refresh_token
    conf.is_active = config_in.is_active
    db.commit()
    db.refresh(conf)
    return conf

# Category Mapping Endpoints
@router.get("/channels/{channel_id}/category-mappings", response_model=List[schemas.ChannelCategoryMappingResponse])
def get_category_mappings(channel_id: int, db: Session = Depends(get_db)):
    return db.query(models.ChannelCategoryMapping).filter(models.ChannelCategoryMapping.channel_id == channel_id).all()

@router.post("/channels/{channel_id}/category-mappings", response_model=List[schemas.ChannelCategoryMappingResponse])
def bulk_save_category_mappings(channel_id: int, mappings: List[schemas.ChannelCategoryMappingCreate], db: Session = Depends(get_db)):
    seen = set()
    for m in mappings:
        if m.pim_category_id in seen:
            raise HTTPException(status_code=400, detail=f"Duplicate mapping found for PIM Category ID {m.pim_category_id}")
        seen.add(m.pim_category_id)
        
    db.query(models.ChannelCategoryMapping).filter(models.ChannelCategoryMapping.channel_id == channel_id).delete()
    db_mappings = []
    for m in mappings:
        db_m = models.ChannelCategoryMapping(
            channel_id=channel_id,
            pim_category_id=m.pim_category_id,
            channel_category_code=m.channel_category_code,
            channel_category_name=m.channel_category_name
        )
        db.add(db_m)
        db_mappings.append(db_m)
    db.commit()
    for db_m in db_mappings:
        db.refresh(db_m)
    return db_mappings

# Attribute Mapping Endpoints
@router.get("/channels/{channel_id}/attribute-mappings", response_model=List[schemas.ChannelAttributeMappingResponse])
def get_attribute_mappings(channel_id: int, db: Session = Depends(get_db)):
    return db.query(models.ChannelAttributeMapping).filter(models.ChannelAttributeMapping.channel_id == channel_id).all()

@router.post("/channels/{channel_id}/attribute-mappings", response_model=List[schemas.ChannelAttributeMappingResponse])
def bulk_save_attribute_mappings(channel_id: int, mappings: List[schemas.ChannelAttributeMappingCreate], db: Session = Depends(get_db)):
    seen = set()
    for m in mappings:
        key = (m.pim_attribute_id, m.channel_category_code)
        if key in seen:
            raise HTTPException(status_code=400, detail=f"Duplicate mapping found for attribute_id {m.pim_attribute_id} and category {m.channel_category_code}")
        seen.add(key)

    db.query(models.ChannelAttributeMapping).filter(models.ChannelAttributeMapping.channel_id == channel_id).delete()
    db_mappings = []
    for m in mappings:
        db_m = models.ChannelAttributeMapping(
            channel_id=channel_id,
            pim_attribute_id=m.pim_attribute_id,
            channel_category_code=m.channel_category_code,
            channel_attribute_code=m.channel_attribute_code,
            channel_attribute_name=m.channel_attribute_name
        )
        db.add(db_m)
        db_mappings.append(db_m)
    db.commit()
    for db_m in db_mappings:
        db.refresh(db_m)
    return db_mappings

@router.get("/export/shopee")
def export_shopee(status: str = "Published", product_ids: Optional[str] = None, db: Session = Depends(get_db)):
    channel = db.query(models.Channel).filter(models.Channel.code == "shopee_vn").first()
    if not channel:
        raise HTTPException(status_code=404, detail="Shopee channel not found")

    query = db.query(models.ProductChannelListing).options(
        selectinload(models.ProductChannelListing.product).selectinload(models.Product.variants),
        selectinload(models.ProductChannelListing.product).selectinload(models.Product.attribute_values),
        selectinload(models.ProductChannelListing.attribute_values),
        selectinload(models.ProductChannelListing.variant_overrides),
        selectinload(models.ProductChannelListing.channel)
    ).filter(
        models.ProductChannelListing.channel_id == channel.id,
        models.ProductChannelListing.status == status
    )

    if product_ids:
        try:
            prod_ids = [int(x.strip()) for x in product_ids.split(",") if x.strip()]
            query = query.filter(models.ProductChannelListing.product_id.in_(prod_ids))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid product_ids format. Must be comma-separated integers.")

    listings = query.all()

    attr_mappings = db.query(models.ChannelAttributeMapping).filter(
        models.ChannelAttributeMapping.channel_id == channel.id
    ).all()

    cat_mappings = db.query(models.ChannelCategoryMapping).filter(
        models.ChannelCategoryMapping.channel_id == channel.id
    ).all()
    cat_map_dict = {m.pim_category_id: m for m in cat_mappings}

    shipping_headers = set()
    for listing in listings:
        if listing.shipping_config and isinstance(listing.shipping_config, dict):
            for k in listing.shipping_config.keys():
                if k.startswith("channel_id_"):
                    shipping_headers.add(k)

    headers = [
        "et_title_variation_integration_no",
        "ps_category",
        "product_name",
        "product_description",
        "sku_code",
        "price",
        "stock",
        "weight",
        "length",
        "width",
        "height",
        "barcode",
        "hs_code",
        "tax_code"
    ]
    for am in attr_mappings:
        if am.channel_attribute_code not in headers:
            headers.append(am.channel_attribute_code)

    for sh in sorted(shipping_headers):
        if sh not in headers:
            headers.append(sh)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()

    for listing in listings:
        product = listing.product
        cat_map = cat_map_dict.get(product.category_id)
        ps_category = cat_map.channel_category_code if cat_map else ""

        chan_attr_vals = listing.attribute_values
        chan_attr_map = {cav.attribute_mapping_id: cav for cav in chan_attr_vals}

        core_attr_vals = product.attribute_values
        core_attr_map = {cav.attribute_id: cav for cav in core_attr_vals}

        attr_data = {}
        for am in attr_mappings:
            val_str = None
            if am.id in chan_attr_map:
                cav = chan_attr_map[am.id]
                val_str = str(cav.value_string) if cav.value_string is not None else (str(cav.value_decimal) if cav.value_decimal is not None else "")
            elif am.pim_attribute_id in core_attr_map:
                cav = core_attr_map[am.pim_attribute_id]
                val_str = str(cav.value_string) if cav.value_string is not None else (str(cav.value_decimal) if cav.value_decimal is not None else "")
            
            attr_data[am.channel_attribute_code] = val_str or ""

        shipping_data = {}
        for sh in shipping_headers:
            val = "Off"
            if listing.shipping_config and isinstance(listing.shipping_config, dict):
                carrier_cfg = listing.shipping_config.get(sh)
                if isinstance(carrier_cfg, dict):
                    val = "On" if carrier_cfg.get("enabled") else "Off"
                elif isinstance(carrier_cfg, bool):
                    val = "On" if carrier_cfg else "Off"
                elif carrier_cfg in ("On", "Off"):
                    val = carrier_cfg
            shipping_data[sh] = val

        var_listings = listing.variant_overrides
        var_map = {vl.variant_id: vl for vl in var_listings}

        for var in product.variants:
            price = var.price
            if var.id in var_map and var_map[var.id].price_override is not None:
                price = var_map[var.id].price_override

            row = {
                "et_title_variation_integration_no": product.product_code,
                "ps_category": ps_category,
                "product_name": listing.title_override or product.name,
                "product_description": listing.description_override or product.description or "",
                "sku_code": var.sku_code,
                "price": float(price),
                "stock": var.stock,
                "weight": product.weight,
                "length": product.length or "",
                "width": product.width or "",
                "height": product.height or "",
                "barcode": var.barcode or "",
                "hs_code": product.hs_code or "",
                "tax_code": product.tax_code or ""
            }
            row.update(attr_data)
            row.update(shipping_data)
            writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        io.StringIO(output.getvalue()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=shopee_export_{status}.csv"}
    )

@router.get("/export/tiktok")
def export_tiktok(status: str = "Published", product_ids: Optional[str] = None, db: Session = Depends(get_db)):
    channel = db.query(models.Channel).filter(models.Channel.code == "tiktok_shop").first()
    if not channel:
        raise HTTPException(status_code=404, detail="TikTok Shop channel not found")

    query = db.query(models.ProductChannelListing).options(
        selectinload(models.ProductChannelListing.product).selectinload(models.Product.variants),
        selectinload(models.ProductChannelListing.product).selectinload(models.Product.attribute_values),
        selectinload(models.ProductChannelListing.attribute_values),
        selectinload(models.ProductChannelListing.variant_overrides),
        selectinload(models.ProductChannelListing.channel)
    ).filter(
        models.ProductChannelListing.channel_id == channel.id,
        models.ProductChannelListing.status == status
    )

    if product_ids:
        try:
            prod_ids = [int(x.strip()) for x in product_ids.split(",") if x.strip()]
            query = query.filter(models.ProductChannelListing.product_id.in_(prod_ids))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid product_ids format. Must be comma-separated integers.")

    listings = query.all()

    attr_mappings = db.query(models.ChannelAttributeMapping).filter(
        models.ChannelAttributeMapping.channel_id == channel.id
    ).all()

    cat_mappings = db.query(models.ChannelCategoryMapping).filter(
        models.ChannelCategoryMapping.channel_id == channel.id
    ).all()
    cat_map_dict = {m.pim_category_id: m for m in cat_mappings}

    shipping_headers = set()
    for listing in listings:
        if listing.shipping_config and isinstance(listing.shipping_config, dict):
            for k in listing.shipping_config.keys():
                if k.startswith("channel_id_"):
                    shipping_headers.add(k)

    headers = [
        "product_name",
        "category_name",
        "product_description",
        "sku_code",
        "price",
        "stock",
        "weight",
        "length",
        "width",
        "height",
        "barcode",
        "hs_code",
        "tax_code"
    ]
    for am in attr_mappings:
        col_name = f"product_property/{am.channel_attribute_code}"
        if col_name not in headers:
            headers.append(col_name)

    for sh in sorted(shipping_headers):
        if sh not in headers:
            headers.append(sh)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()

    for listing in listings:
        product = listing.product
        cat_map = cat_map_dict.get(product.category_id)
        category_name = cat_map.channel_category_name if cat_map else ""

        chan_attr_vals = listing.attribute_values
        chan_attr_map = {cav.attribute_mapping_id: cav for cav in chan_attr_vals}

        core_attr_vals = product.attribute_values
        core_attr_map = {cav.attribute_id: cav for cav in core_attr_vals}

        attr_data = {}
        for am in attr_mappings:
            val_str = None
            if am.id in chan_attr_map:
                cav = chan_attr_map[am.id]
                val_str = str(cav.value_string) if cav.value_string is not None else (str(cav.value_decimal) if cav.value_decimal is not None else "")
            elif am.pim_attribute_id in core_attr_map:
                cav = core_attr_map[am.pim_attribute_id]
                val_str = str(cav.value_string) if cav.value_string is not None else (str(cav.value_decimal) if cav.value_decimal is not None else "")
            
            col_name = f"product_property/{am.channel_attribute_code}"
            attr_data[col_name] = val_str or ""

        shipping_data = {}
        for sh in shipping_headers:
            val = "Off"
            if listing.shipping_config and isinstance(listing.shipping_config, dict):
                carrier_cfg = listing.shipping_config.get(sh)
                if isinstance(carrier_cfg, dict):
                    val = "On" if carrier_cfg.get("enabled") else "Off"
                elif isinstance(carrier_cfg, bool):
                    val = "On" if carrier_cfg else "Off"
                elif carrier_cfg in ("On", "Off"):
                    val = carrier_cfg
            shipping_data[sh] = val

        var_listings = listing.variant_overrides
        var_map = {vl.variant_id: vl for vl in var_listings}

        for var in product.variants:
            price = var.price
            if var.id in var_map and var_map[var.id].price_override is not None:
                price = var_map[var.id].price_override

            row = {
                "product_name": listing.title_override or product.name,
                "category_name": category_name,
                "product_description": listing.description_override or product.description or "",
                "sku_code": var.sku_code,
                "price": float(price),
                "stock": var.stock,
                "weight": product.weight,
                "length": product.length or "",
                "width": product.width or "",
                "height": product.height or "",
                "barcode": var.barcode or "",
                "hs_code": product.hs_code or "",
                "tax_code": product.tax_code or ""
            }
            row.update(attr_data)
            row.update(shipping_data)
            writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        io.StringIO(output.getvalue()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=tiktok_export_{status}.csv"}
    )
