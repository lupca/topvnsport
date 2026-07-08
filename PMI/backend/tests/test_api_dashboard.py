def test_get_dashboard_stats(client):
    response = client.get("/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_products" in data
    assert "active_products" in data
    assert "inactive_products" in data
    assert "total_categories" in data
    assert "total_attributes" in data
    assert "total_groups" in data
    assert "total_families" in data
    assert "total_locales" in data
    assert "total_currencies" in data
    assert "total_channels" in data
    assert "completeness_rate" in data
    assert "activity_data" in data
    
    # Assert activity data has exactly 7 days
    assert len(data["activity_data"]) == 7
