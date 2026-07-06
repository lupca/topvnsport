import os
import io
import json
from minio import Minio
from minio.error import S3Error

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "db:9000") # db is localhost or the minio container name in docker compose
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_SECURE = os.getenv("MINIO_SECURE", "False").lower() == "true"
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "pim-media")
MINIO_PUBLIC_BASE_URL = os.getenv("MINIO_PUBLIC_BASE_URL", "").strip()

# Initialize minio client
client = None
try:
    client = Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE
    )
except Exception as e:
    print(f"Failed to initialize MinIO client: {e}")

def init_bucket():
    if not client:
        return
    try:
        found = client.bucket_exists(MINIO_BUCKET)
        if not found:
            client.make_bucket(MINIO_BUCKET)
            print(f"Created bucket {MINIO_BUCKET}")
            
            # Set public read policy for the bucket
            policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "PublicRead",
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{MINIO_BUCKET}/*"]
                    }
                ]
            }
            client.set_bucket_policy(MINIO_BUCKET, json.dumps(policy))
    except S3Error as err:
        print(f"MinIO bucket initialization error: {err}")

def upload_file(file_data: bytes, file_name: str, content_type: str) -> str:
    if not client:
        raise Exception("MinIO client is not initialized")
    
    try:
        # Create bucket if not exists
        init_bucket()
        
        # Upload
        file_size = len(file_data)
        client.put_object(
            MINIO_BUCKET,
            file_name,
            io.BytesIO(file_data),
            file_size,
            content_type=content_type
        )
        
        # Return URL that browser can access. If a public base URL is set, use it.
        # Fallback keeps the previous behavior for local/dev compatibility.
        if MINIO_PUBLIC_BASE_URL:
            return f"{MINIO_PUBLIC_BASE_URL.rstrip('/')}/{MINIO_BUCKET}/{file_name}"

        protocol = "https" if MINIO_SECURE else "http"
        return f"{protocol}://{MINIO_ENDPOINT}/{MINIO_BUCKET}/{file_name}"
    except S3Error as err:
        print(f"Error uploading file to MinIO: {err}")
        raise err
