def test_upload_image(client, mocker):
    mocker.patch(
        "utils.storage.upload_file",
        return_value="https://topvnsport-assets.s3.us-east-1.amazonaws.com/test.jpg",
    )
    
    files = {"file": ("test.jpg", b"dummy content", "image/jpeg")}
    response = client.post("/upload", files=files)
    
    assert response.status_code == 200
    assert response.json()["image_url"] == "https://topvnsport-assets.s3.us-east-1.amazonaws.com/test.jpg"
