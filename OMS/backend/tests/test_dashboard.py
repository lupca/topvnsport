import models


def test_dashboard_stats(client, db):
    cust = models.Customer(name="Tester", phone="0111111111")
    db.add(cust)
    chan = db.query(models.Channel).filter(models.Channel.code == "SHOPEE").first()
    db.commit()

    order = models.Order(
        order_number="ORD-DASH-1",
        customer_id=cust.id,
        channel_id=chan.id,
        status="CONFIRMED",
        total_amount=250.0,
        shipping_fee=20.0,
        shipping_address="Hanoi"
    )
    db.add(order)
    db.commit()

    resp = client.get("/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["order_count"] >= 1
    assert data["customer_count"] >= 1
    assert data["revenue"] >= 250.0
    assert "status_counts" in data
    assert "daily_stats" in data
    assert len(data["daily_stats"]) == 7
