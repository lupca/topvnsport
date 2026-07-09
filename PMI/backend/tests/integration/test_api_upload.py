def test_upload_image(client, mocker):
    # Mock minio upload
    mocker.patch("minio_client.upload_file", return_value="http://minio/bucket/test.jpg")
    
    files = {"file": ("test.jpg", b"dummy content", "image/jpeg")}
    response = client.post("/upload", files=files)
    
    assert response.status_code == 200
    assert response.json()["image_url"] == "http://minio/bucket/test.jpg"
