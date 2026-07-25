from unittest.mock import Mock

from utils import storage


def test_upload_file_puts_object_and_returns_download_url(monkeypatch):
    client = Mock()
    client.generate_presigned_url.return_value = "https://signed.example/image.jpg"
    monkeypatch.setattr(storage, "s3_client", client)

    url = storage.upload_file(b"image-bytes", "products/image.jpg", "image/jpeg")

    client.put_object.assert_called_once_with(
        Bucket=storage.S3_BUCKET,
        Key="products/image.jpg",
        Body=b"image-bytes",
        ContentType="image/jpeg",
    )
    assert url == "https://signed.example/image.jpg"


def test_download_file_reads_s3_body(monkeypatch):
    body = Mock()
    body.read.return_value = b"image-bytes"
    client = Mock()
    client.get_object.return_value = {"Body": body}
    monkeypatch.setattr(storage, "s3_client", client)

    assert storage.download_file("products/image.jpg") == b"image-bytes"
    client.get_object.assert_called_once_with(Bucket=storage.S3_BUCKET, Key="products/image.jpg")


def test_delete_file_deletes_s3_object(monkeypatch):
    client = Mock()
    monkeypatch.setattr(storage, "s3_client", client)

    storage.delete_file("products/image.jpg")

    client.delete_object.assert_called_once_with(
        Bucket=storage.S3_BUCKET,
        Key="products/image.jpg",
    )
