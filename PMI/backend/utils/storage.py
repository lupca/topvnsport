"""S3-backed object storage for PMI media files.

The production bucket is private.  Uploads therefore return a presigned GET
URL unless ``S3_PUBLIC_BASE_URL`` is configured (for example, a CDN or an
application proxy).  AWS credentials are intentionally not hard-coded; boto3
uses the standard AWS credential chain, including an EC2 instance role.
"""

from __future__ import annotations

import logging
import os
from typing import BinaryIO
from urllib.parse import quote

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)

AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION", "us-east-1")
S3_BUCKET = os.getenv("S3_BUCKET") or os.getenv("AWS_S3_BUCKET", "topvnsport-assets")
S3_PUBLIC_BASE_URL = os.getenv("S3_PUBLIC_BASE_URL", "").strip()
S3_PRESIGNED_URL_EXPIRY = int(os.getenv("S3_PRESIGNED_URL_EXPIRY", "3600"))
S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL", "").strip() or None

s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
    endpoint_url=S3_ENDPOINT_URL,
)


def _object_url(file_name: str) -> str:
    encoded_name = quote(file_name, safe="/")
    if S3_PUBLIC_BASE_URL:
        return f"{S3_PUBLIC_BASE_URL.rstrip('/')}/{encoded_name}"

    return s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": file_name},
        ExpiresIn=S3_PRESIGNED_URL_EXPIRY,
    )


def init_bucket() -> bool:
    """Check that the provisioned bucket is reachable.

    Bucket creation and public policies are deliberately not attempted here:
    infrastructure owns the bucket and keeps it private.
    """

    try:
        s3_client.head_bucket(Bucket=S3_BUCKET)
        return True
    except (BotoCoreError, ClientError) as exc:
        logger.warning("S3 bucket %s is not reachable: %s", S3_BUCKET, exc)
        return False


def upload_file(file_data: bytes | BinaryIO, file_name: str, content_type: str | None = None) -> str:
    """Upload an object and return a URL that can be used to download it."""

    params: dict[str, object] = {
        "Bucket": S3_BUCKET,
        "Key": file_name,
        "Body": file_data,
    }
    if content_type:
        params["ContentType"] = content_type

    s3_client.put_object(**params)
    return _object_url(file_name)


def download_file(file_name: str) -> bytes:
    """Download an object from S3 and return its bytes."""

    response = s3_client.get_object(Bucket=S3_BUCKET, Key=file_name)
    return response["Body"].read()


def delete_file(file_name: str) -> None:
    """Delete an object from S3."""

    s3_client.delete_object(Bucket=S3_BUCKET, Key=file_name)
