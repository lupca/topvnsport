from uuid import uuid4

from sqlalchemy import event


def _seed_products(db_session, count=10):
    import models

    products = []
    for index in range(count):
        product = models.Product(
            product_code=f"QUERY-COUNT-{uuid4().hex[:8]}-{index}",
            name=f"Query count product {index}",
            weight=100,
            status="Draft",
            category=models.Category(
                name=f"Query count category {index}",
                code=f"QUERY-CATEGORY-{uuid4().hex[:8]}-{index}",
            ),
            tier_variations=[models.TierVariation(
                tier_index=1,
                name="Color",
                options=["Red", "Blue"],
            )],
            variants=[
                models.ProductVariant(
                    tier_1_option="Red",
                    sku_code=f"QUERY-SKU-{uuid4().hex[:8]}-{index}-RED",
                    price=100,
                ),
                models.ProductVariant(
                    tier_1_option="Blue",
                    sku_code=f"QUERY-SKU-{uuid4().hex[:8]}-{index}-BLUE",
                    price=100,
                ),
            ],
        )
        products.append(product)
        db_session.add(product)

    db_session.flush()
    return products


def test_product_list_query_count_is_bounded(client, db_session):
    _seed_products(db_session, count=25)
    queries = []

    def log_query(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    event.listen(db_session.bind, "before_cursor_execute", log_query)
    try:
        response = client.get("/products", params={"page": 1, "limit": 25})
    finally:
        event.remove(db_session.bind, "before_cursor_execute", log_query)

    assert response.status_code == 200
    assert len(response.json()["items"]) == 25
    select_queries = [query for query in queries if query.lstrip().upper().startswith("SELECT")]
    assert len(select_queries) <= 12, f"Product list issued too many queries: {len(select_queries)}"


def test_product_by_sku_query_count_is_bounded(client, db_session):
    product = _seed_products(db_session, count=1)[0]
    sku_code = product.variants[0].sku_code
    queries = []

    def log_query(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    event.listen(db_session.bind, "before_cursor_execute", log_query)
    try:
        response = client.get(f"/api/products/by-sku/{sku_code}")
    finally:
        event.remove(db_session.bind, "before_cursor_execute", log_query)

    assert response.status_code == 200
    assert response.json()["sku_code"] == sku_code
    select_queries = [query for query in queries if query.lstrip().upper().startswith("SELECT")]
    assert len(select_queries) <= 3, f"SKU lookup issued too many queries: {len(select_queries)}"


def test_batch_delete_missing_product_is_atomic(client, db_session):
    products = _seed_products(db_session, count=3)
    product_ids = [product.id for product in products]
    # Make the seeded products pre-existing data. The endpoint rollback must
    # not erase data created in the same transaction as the test setup.
    db_session.commit()

    response = client.post(
        "/products/batch-delete",
        json={"product_ids": product_ids + [999999999]},
    )

    assert response.status_code == 404
    import models
    assert db_session.query(models.Product).filter(
        models.Product.id.in_(product_ids)
    ).count() == len(product_ids)
