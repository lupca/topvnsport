# TODO: Performance - N+1 Queries & Transaction Boundaries

## Mức độ: MEDIUM
## Estimated Effort: Medium (3-5 hours)

---

## Mô Tả Vấn Đề

### Problem 1: N+1 Query Pattern

Một số endpoints thực hiện queries trong loop, gây performance degradation với large datasets.

**PMI/backend/routers/products.py (lines 275-291):**
```python
@router.get("/sku/{sku}")
async def get_product_by_sku(sku: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.sku == sku).first()
    if product:
        # N+1: Separate query for each tier variation
        tier_variations = db.query(TierVariation).filter(
            TierVariation.product_id == product.id
        ).all()
        # Another N+1 for variants per tier
        for tier in tier_variations:
            tier.variants = db.query(ProductVariant).filter(...)
```

**PMI/backend/routers/categories.py (lines 46-50):**
```python
def get_category_with_ancestors(category_id: int, db: Session):
    category = db.query(Category).get(category_id)
    ancestors = []
    while category.parent_id:
        # N+1: One query per ancestor level
        category = db.query(Category).get(category.parent_id)
        ancestors.append(category)
```

### Problem 2: Missing Transaction Boundaries

**PMI/backend/routers/products.py (lines 250-260):**
```python
@router.delete("/batch")
async def batch_delete_products(product_ids: List[int], db: Session = Depends(get_db)):
    deleted = []
    for product_id in product_ids:
        # Each delete is a separate transaction
        # If one fails, previous deletes are NOT rolled back
        product = db.query(Product).get(product_id)
        db.delete(product)
        db.commit()  # Commit inside loop = inconsistent state on failure
        deleted.append(product_id)
```

---

## Impact

- **Performance:** 100 products = 100+ database queries instead of 1-2
- **Data Integrity:** Partial batch operations leave inconsistent state
- **Scalability:** Query count grows linearly with data size

---

## Steps to Implement

### Fix 1: N+1 in Product SKU Lookup

**Before:**
```python
product = db.query(Product).filter(Product.sku == sku).first()
tier_variations = db.query(TierVariation).filter(...)
for tier in tier_variations:
    tier.variants = db.query(ProductVariant).filter(...)
```

**After:**
```python
from sqlalchemy.orm import selectinload, joinedload

product = db.query(Product).options(
    selectinload(Product.tier_variations).selectinload(TierVariation.variants),
    selectinload(Product.media),
    selectinload(Product.attribute_values),
).filter(Product.sku == sku).first()

# All related data loaded in 2-3 queries total
```

### Fix 2: N+1 in Category Ancestors

**Before:**
```python
def get_category_with_ancestors(category_id: int, db: Session):
    ancestors = []
    category = db.query(Category).get(category_id)
    while category.parent_id:
        category = db.query(Category).get(category.parent_id)
        ancestors.append(category)
    return ancestors
```

**After (Option A - Recursive CTE):**
```python
from sqlalchemy import text

def get_category_with_ancestors(category_id: int, db: Session):
    query = text("""
        WITH RECURSIVE ancestors AS (
            SELECT id, name, parent_id, 0 as depth
            FROM categories
            WHERE id = :category_id
            
            UNION ALL
            
            SELECT c.id, c.name, c.parent_id, a.depth + 1
            FROM categories c
            JOIN ancestors a ON c.id = a.parent_id
        )
        SELECT * FROM ancestors ORDER BY depth DESC
    """)
    
    result = db.execute(query, {"category_id": category_id})
    return [dict(row) for row in result]
```

**After (Option B - Materialized Path):**
```python
# Add path column to Category model
class Category(Base):
    path = Column(String)  # e.g., "1/5/12" for ancestry chain

# Query becomes simple
def get_ancestors(category_id: int, db: Session):
    category = db.query(Category).get(category_id)
    ancestor_ids = [int(id) for id in category.path.split('/')]
    return db.query(Category).filter(Category.id.in_(ancestor_ids)).all()
```

### Fix 3: Transaction Boundary for Batch Operations

**Before:**
```python
@router.delete("/batch")
async def batch_delete_products(product_ids: List[int], db: Session = Depends(get_db)):
    for product_id in product_ids:
        product = db.query(Product).get(product_id)
        db.delete(product)
        db.commit()  # BAD: Commit inside loop
```

**After:**
```python
@router.delete("/batch")
async def batch_delete_products(product_ids: List[int], db: Session = Depends(get_db)):
    try:
        # Single transaction for all deletes
        products = db.query(Product).filter(Product.id.in_(product_ids)).all()
        
        if len(products) != len(product_ids):
            found_ids = {p.id for p in products}
            missing = set(product_ids) - found_ids
            raise HTTPException(404, f"Products not found: {missing}")
        
        for product in products:
            db.delete(product)
        
        db.commit()  # Single commit at the end
        return {"deleted": product_ids}
        
    except Exception as e:
        db.rollback()  # Rollback entire batch on any failure
        raise
```

### Fix 4: Add Query Count Logging (Debug)

**File: PMI/backend/utils/query_logger.py** (NEW - for development)

```python
import logging
from sqlalchemy import event
from sqlalchemy.engine import Engine

query_count = 0

@event.listens_for(Engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    global query_count
    query_count += 1
    if query_count > 10:  # Alert on potential N+1
        logging.warning(f"High query count: {query_count} - possible N+1")

def reset_query_count():
    global query_count
    query_count = 0
```

---

## Files Cần Modify

| File | Action |
|------|--------|
| `PMI/backend/routers/products.py` | Add eager loading, fix batch delete |
| `PMI/backend/routers/categories.py` | Fix ancestor lookup with CTE |
| `PMI/backend/services/product_service.py` | Review and add selectinload where missing |
| `PMI/backend/models.py` | (Optional) Add materialized path for categories |

---

## Verification

### Performance Testing

```python
# tests/performance/test_n1_queries.py
import time
from sqlalchemy import event

def test_product_list_query_count(db, seed_100_products):
    queries = []
    
    @event.listens_for(db.bind, "before_cursor_execute")
    def log_query(conn, cursor, statement, *args):
        queries.append(statement)
    
    # Call the endpoint
    response = client.get("/api/v1/products?limit=100")
    
    # Should be <= 5 queries (products + eager loads)
    # NOT 100+ queries (N+1)
    assert len(queries) <= 5, f"N+1 detected: {len(queries)} queries"

def test_batch_delete_is_atomic(db, seed_products):
    product_ids = [1, 2, 3, 999]  # 999 doesn't exist
    
    response = client.delete("/api/v1/products/batch", json=product_ids)
    
    assert response.status_code == 404
    
    # Verify NO products were deleted (atomic rollback)
    for pid in [1, 2, 3]:
        assert db.query(Product).get(pid) is not None
```

### Manual Testing

```bash
# Enable SQL logging
export SQLALCHEMY_ECHO=true

# Run endpoint and count queries in logs
curl http://localhost:18100/api/v1/products?limit=100

# Expected: ~5 queries
# N+1 symptom: 100+ SELECT statements
```

---

## Notes

- `selectinload` is preferred over `joinedload` for one-to-many relationships (avoids cartesian product)
- Consider adding database indexes if query performance is still slow
- For very deep category trees, materialized path or nested sets may be better than recursive CTEs
