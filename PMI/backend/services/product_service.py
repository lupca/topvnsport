from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
import models
import schemas

def _parse_attribute_storage_value(raw_value: str, attr_type: str):
    text_value = (raw_value or "").strip()
    if text_value == "":
        return None, None

    if attr_type in {"decimal", "number", "float", "integer"}:
        try:
            return None, float(text_value)
        except ValueError:
            # Keep non-normalized values (e.g. "0.68mm") as text.
            return text_value, None

    return text_value, None

def _upsert_product_attribute_values(db: Session, product_id: int, incoming_attributes: List[schemas.ProductAttributeInput]):
    db.query(models.ProductAttributeValue).filter(
        models.ProductAttributeValue.product_id == product_id
    ).delete(synchronize_session=False)

    if not incoming_attributes:
        return

    attribute_ids = [a.id for a in incoming_attributes]
    attribute_map = {
        a.id: a
        for a in db.query(models.Attribute).filter(models.Attribute.id.in_(attribute_ids)).all()
    }

    for item in incoming_attributes:
        attribute = attribute_map.get(item.id)
        if not attribute:
            continue
        value_string, value_decimal = _parse_attribute_storage_value(item.value, attribute.type)
        if value_string is None and value_decimal is None:
            continue
        db.add(models.ProductAttributeValue(
            product_id=product_id,
            attribute_id=attribute.id,
            value_string=value_string,
            value_decimal=value_decimal,
        ))

def _save_product_channel_listings(
    db: Session,
    product_id: int,
    channel_listings: List[schemas.ProductChannelListingCreate],
    db_variants: List[models.ProductVariant],
    existing_vo_map: Optional[dict] = None
):
    # 1. Fetch existing listings and index by channel code
    existing_listings = db.query(models.ProductChannelListing).filter(
        models.ProductChannelListing.product_id == product_id
    ).all()
    channel_ids = [el.channel_id for el in existing_listings]
    existing_channels = db.query(models.Channel).filter(models.Channel.id.in_(channel_ids)).all() if channel_ids else []
    chan_id_to_code = {c.id: c.code for c in existing_channels}
    
    existing_map = {}
    for el in existing_listings:
        code = chan_id_to_code.get(el.channel_id)
        if code:
            existing_map[code] = el

    # Index existing variant overrides to preserve channel_variant_id
    if existing_vo_map is None:
        existing_vo_map = {}
        existing_vos = db.query(models.VariantChannelListing).filter(
            models.VariantChannelListing.product_id == product_id
        ).all()
        variant_ids = [vo.variant_id for vo in existing_vos]
        existing_variants = db.query(models.ProductVariant).filter(models.ProductVariant.id.in_(variant_ids)).all() if variant_ids else []
        var_id_to_sku = {v.id: v.sku_code for v in existing_variants}
        for vo in existing_vos:
            sku = var_id_to_sku.get(vo.variant_id)
            if sku:
                existing_vo_map[(vo.channel_id, sku)] = vo.channel_variant_id

    # Delete listings that are not in the new payload (deactivated)
    incoming_codes = {cl.channel_code for cl in channel_listings}
    for code, el in list(existing_map.items()):
        if code not in incoming_codes:
            db.delete(el)
            existing_map.pop(code)

    for cl in channel_listings:
        channel = db.query(models.Channel).filter(models.Channel.code == cl.channel_code).first()
        if not channel:
            raise HTTPException(status_code=400, detail=f"Channel with code '{cl.channel_code}' not found")
        
        if cl.channel_code in existing_map:
            db_cl = existing_map[cl.channel_code]
            db_cl.status = cl.status
            db_cl.title_override = cl.title_override
            db_cl.description_override = cl.description_override
            db_cl.shipping_config = cl.shipping_config
            if cl.channel_product_id:
                db_cl.channel_product_id = cl.channel_product_id
        else:
            db_cl = models.ProductChannelListing(
                product_id=product_id,
                channel_id=channel.id,
                status=cl.status,
                title_override=cl.title_override,
                description_override=cl.description_override,
                shipping_config=cl.shipping_config,
                channel_product_id=cl.channel_product_id
            )
            db.add(db_cl)
        db.flush()
        
        # Clear child attribute values and variant overrides for this channel
        db.query(models.ProductChannelAttributeValue).filter(
            models.ProductChannelAttributeValue.product_id == product_id,
            models.ProductChannelAttributeValue.channel_id == channel.id
        ).delete(synchronize_session=False)

        db.query(models.VariantChannelListing).filter(
            models.VariantChannelListing.product_id == product_id,
            models.VariantChannelListing.channel_id == channel.id
        ).delete(synchronize_session=False)

        for attr_val in cl.attribute_values:
            db_attr_val = models.ProductChannelAttributeValue(
                product_id=product_id,
                channel_id=channel.id,
                listing_id=db_cl.id,
                attribute_mapping_id=attr_val.attribute_mapping_id,
                value_string=attr_val.value_string,
                value_decimal=attr_val.value_decimal
            )
            db.add(db_attr_val)
            
        for vo in cl.variant_overrides:
            db_var = next((v for v in db_variants if v.sku_code == vo.sku_code), None)
            if not db_var:
                raise HTTPException(status_code=400, detail=f"Variant SKU '{vo.sku_code}' not found in variants list")
            
            chan_var_id = vo.channel_variant_id
            if not chan_var_id:
                chan_var_id = existing_vo_map.get((channel.id, vo.sku_code))

            db_vo = models.VariantChannelListing(
                variant_id=db_var.id,
                channel_id=channel.id,
                product_id=product_id,
                listing_id=db_cl.id,
                price_override=vo.price_override,
                channel_variant_id=chan_var_id
            )
            db.add(db_vo)
