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
                available_skus = [v.sku_code for v in db_variants]
                raise HTTPException(status_code=400, detail=f"Variant SKU '{vo.sku_code}' not found in variants list. Available: {available_skus}")
            
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


def serialize_product_aggregate(product: models.Product) -> dict:
    """
    Serializes the product aggregate state into a dictionary for audit diffing.
    """
    state = {
        "product_code": product.product_code,
        "name": product.name,
        "description": product.description,
        "category_id": product.category_id,
        "family_id": product.family_id,
        "weight": product.weight,
        "length": product.length,
        "width": product.width,
        "height": product.height,
        "hs_code": product.hs_code,
        "tax_code": product.tax_code,
        "is_pre_order": product.is_pre_order,
        "dts_days": product.dts_days,
        "status": product.status,
        
        "tier_variations": [
            {
                "tier_index": tv.tier_index,
                "name": tv.name,
                "options": tv.options
            } for tv in sorted(product.tier_variations, key=lambda x: x.tier_index)
        ],
        
        "variants": [
            {
                "sku_code": v.sku_code,
                "tier_1_option": v.tier_1_option,
                "tier_2_option": v.tier_2_option,
                "price": float(v.price) if v.price is not None else None,
                "barcode": v.barcode
            } for v in sorted(product.variants, key=lambda x: x.sku_code or "")
        ],
        
        "media": [
            {
                "image_url": m.image_url,
                "is_cover": m.is_cover,
                "display_order": m.display_order,
                "variant_sku": m.variant.sku_code if m.variant else None
            } for m in sorted(product.media, key=lambda x: x.display_order)
        ],
        
        "attribute_values": [
            {
                "attribute_code": cav.attribute.code if cav.attribute else str(cav.attribute_id),
                "value_string": cav.value_string,
                "value_decimal": float(cav.value_decimal) if cav.value_decimal is not None else None
            } for cav in sorted(product.attribute_values, key=lambda x: x.attribute_id)
        ],
        
        "channel_listings": [
            {
                "channel_code": cl.channel.code if cl.channel else str(cl.channel_id),
                "status": cl.status,
                "title_override": cl.title_override,
                "description_override": cl.description_override,
                "shipping_config": cl.shipping_config,
                "channel_product_id": cl.channel_product_id,
                "attribute_values": [
                    {
                        "attribute_mapping_id": cav.attribute_mapping_id,
                        "value_string": cav.value_string,
                        "value_decimal": float(cav.value_decimal) if cav.value_decimal is not None else None
                    } for cav in sorted(cl.attribute_values, key=lambda x: x.attribute_mapping_id)
                ],
                "variant_overrides": [
                    {
                        "variant_sku": vo.variant.sku_code if vo.variant else str(vo.variant_id),
                        "price_override": float(vo.price_override) if vo.price_override is not None else None,
                        "channel_variant_id": vo.channel_variant_id
                    } for vo in sorted(cl.variant_overrides, key=lambda x: x.variant_id)
                ]
            } for cl in sorted(product.channel_listings, key=lambda x: x.channel_id)
        ]
    }
    return state


def update_product_aggregate(db: Session, product_id: int, product_in: schemas.ProductUpdate) -> models.Product:
    """
    Updates the product aggregate state, performs semantic diffing and logs to audit outbox.
    """
    from sqlalchemy.orm import selectinload
    from utils.masking import mask_sensitive_data
    from utils.audit import record_audit_event

    db_product = db.query(models.Product).options(
        selectinload(models.Product.family),
        selectinload(models.Product.tier_variations),
        selectinload(models.Product.variants),
        selectinload(models.Product.media),
        selectinload(models.Product.attribute_values).selectinload(models.ProductAttributeValue.attribute),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.attribute_values),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.variant_overrides),
        selectinload(models.Product.channel_listings).selectinload(models.ProductChannelListing.channel)
    ).filter(models.Product.id == product_id).first()
    
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Snapshot/serialize old state
    old_state = serialize_product_aggregate(db_product)
    old_masked = mask_sensitive_data(old_state)

    # Pre-load existing variant overrides map before they are cleared
    existing_vos = db.query(models.VariantChannelListing).filter(
        models.VariantChannelListing.product_id == product_id
    ).all()
    existing_vo_map = {}
    for vo in existing_vos:
        if vo.variant and vo.variant.sku_code:
            existing_vo_map[(vo.channel_id, vo.variant.sku_code)] = vo.channel_variant_id

    # Update basic fields
    db_product.product_code = product_in.product_code
    db_product.name = product_in.name
    db_product.description = product_in.description
    db_product.category_id = product_in.category_id
    db_product.family_id = product_in.family_id
    db_product.weight = product_in.weight
    db_product.length = product_in.length
    db_product.width = product_in.width
    db_product.height = product_in.height
    db_product.hs_code = product_in.hs_code
    db_product.tax_code = product_in.tax_code
    db_product.is_pre_order = product_in.is_pre_order
    db_product.dts_days = product_in.dts_days
    db_product.status = product_in.status

    # Clear lists to delete orphans
    db_product.tier_variations.clear()
    db_product.variants.clear()
    db_product.media.clear()
    db.flush()
    
    # Save new Tier Variations
    for tv in product_in.tier_variations:
        db_tv = models.TierVariation(
            product_id=product_id,
            tier_index=tv.tier_index,
            name=tv.name,
            options=tv.options
        )
        db_product.tier_variations.append(db_tv)
        
    # Save new Product Variants
    db_variants = []
    from utils.sku_helper import generate_sku_code
    for v in product_in.variants:
        sku = v.sku_code
        if not sku:
            sku = generate_sku_code(product_in.product_code, v.tier_1_option, v.tier_2_option)
        db_var = models.ProductVariant(
            product_id=product_id,
            tier_1_option=v.tier_1_option,
            tier_2_option=v.tier_2_option,
            sku_code=sku,
            price=v.price,
            barcode=v.barcode,
            default_cost_price=v.default_cost_price,
            default_tax_rate=v.default_tax_rate
        )
        db_product.variants.append(db_var)
        db_variants.append(db_var)
    
    db.flush() # Populate variants IDs for media mapping
    
    # Save new Media
    for m in product_in.media:
        variant_id = None
        if m.variant_tier_1_option:
            for db_var in db_variants:
                if db_var.tier_1_option == m.variant_tier_1_option:
                    variant_id = db_var.id
                    break
        
        db_media = models.ProductMedia(
            product_id=product_id,
            variant_id=variant_id,
            image_url=m.image_url,
            is_cover=m.is_cover,
            display_order=m.display_order
        )
        db_product.media.append(db_media)

    _upsert_product_attribute_values(db, product_id, product_in.attributes)
    _save_product_channel_listings(db, product_id, product_in.channel_listings, db_variants, existing_vo_map)

    # Flush changes to session context
    db.flush()
    
    # Refresh / expire the aggregate to fetch fresh values for the new snapshot
    db.expire(db_product)

    # Snapshot/serialize new state
    new_state = serialize_product_aggregate(db_product)
    new_masked = mask_sensitive_data(new_state)

    # Semantic comparison
    changes = {
        "before": {},
        "after": {}
    }
    basic_fields = [
        "product_code", "name", "description", "category_id", "family_id",
        "weight", "length", "width", "height", "hs_code", "tax_code",
        "is_pre_order", "dts_days", "status"
    ]
    for field in basic_fields:
        old_val = old_masked.get(field)
        new_val = new_masked.get(field)
        if old_val != new_val:
            changes["before"][field] = old_val
            changes["after"][field] = new_val

    # Compare variants
    old_variants = {v["sku_code"]: v for v in old_masked.get("variants", [])}
    new_variants = {v["sku_code"]: v for v in new_masked.get("variants", [])}

    variants_added = []
    variants_removed = []
    variants_modified = {}

    for sku, v in new_variants.items():
        if sku not in old_variants:
            variants_added.append(v)
        else:
            old_v = old_variants[sku]
            v_diff = {}
            for f in ["price", "barcode"]:
                if old_v[f] != v[f]:
                    v_diff[f] = {"before": old_v[f], "after": v[f]}
            if v_diff:
                variants_modified[sku] = v_diff

    for sku, v in old_variants.items():
        if sku not in new_variants:
            variants_removed.append(v)

    if variants_added:
        changes["after"]["variants_added"] = variants_added
    if variants_removed:
        changes["before"]["variants_removed"] = variants_removed
    if variants_modified:
        changes["before"]["variants_modified"] = {sku: {f: diff["before"] for f, diff in fields.items()} for sku, fields in variants_modified.items()}
        changes["after"]["variants_modified"] = {sku: {f: diff["after"] for f, diff in fields.items()} for sku, fields in variants_modified.items()}

    details = []
    if changes["before"]:
        changed_fields = [f for f in basic_fields if f in changes["before"]]
        if changed_fields:
            details.append(f"Updated fields: {', '.join(changed_fields)}")

    if variants_added:
        details.append(f"Added variants: {', '.join(v['sku_code'] for v in variants_added)}")
    if variants_removed:
        details.append(f"Removed variants: {', '.join(v['sku_code'] for v in variants_removed)}")
    if variants_modified:
        details.append(f"Modified variants: {', '.join(variants_modified.keys())}")

    # Compare attributes
    old_attrs = {a["attribute_code"]: a for a in old_masked.get("attribute_values", [])}
    new_attrs = {a["attribute_code"]: a for a in new_masked.get("attribute_values", [])}
    attrs_changed = False
    for code, val in new_attrs.items():
        if code not in old_attrs or old_attrs[code] != val:
            attrs_changed = True
            break
    if not attrs_changed:
        for code in old_attrs:
            if code not in new_attrs:
                attrs_changed = True
                break
    if attrs_changed:
        details.append("Updated attribute values")
        changes["before"]["attribute_values"] = old_masked.get("attribute_values", [])
        changes["after"]["attribute_values"] = new_masked.get("attribute_values", [])

    # Compare channel listings
    old_channels = {c["channel_code"]: c for c in old_masked.get("channel_listings", [])}
    new_channels = {c["channel_code"]: c for c in new_masked.get("channel_listings", [])}
    channels_changed = False
    for code, val in new_channels.items():
        if code not in old_channels or old_channels[code] != val:
            channels_changed = True
            break
    if not channels_changed:
        for code in old_channels:
            if code not in new_channels:
                channels_changed = True
                break
    if channels_changed:
        details.append("Updated channel listings")
        changes["before"]["channel_listings"] = old_masked.get("channel_listings", [])
        changes["after"]["channel_listings"] = new_masked.get("channel_listings", [])

    raw_details = "; ".join(details) if details else "No semantic changes detected."

    import json
    changes_str = json.dumps(changes)
    if len(changes_str) > 100000:  # 100KB
        simplified_before = {}
        simplified_after = {}
        for f in basic_fields:
            if f in changes["before"]:
                simplified_before[f] = changes["before"][f]
            if f in changes["after"]:
                simplified_after[f] = changes["after"][f]
        simplified_before["_truncated"] = True
        simplified_after["_truncated"] = True
        simplified_before["_message"] = "Variants and attributes detailed changes omitted due to size limit (>100KB)"
        simplified_after["_message"] = "Variants and attributes detailed changes omitted due to size limit (>100KB)"
        changes = {
            "before": simplified_before,
            "after": simplified_after
        }

    # Record Audit Event
    record_audit_event(
        db_session=db,
        module="Product",
        action_type="UPDATE",
        entity_type="Product",
        entity_id=product_id,
        changes=changes,
        raw_details=raw_details
    )

    from services.promotion_service import recompute_variant_prices
    recompute_variant_prices(db, variant_ids=[str(v.id) for v in db_product.variants if v.id])

    return db_product

