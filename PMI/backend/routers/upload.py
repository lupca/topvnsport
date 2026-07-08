import uuid
from fastapi import APIRouter, HTTPException, File, UploadFile
import minio_client

router = APIRouter(tags=['Upload'])

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
        file_ext = file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        
        # Upload using the minio helper
        image_url = minio_client.upload_file(
            file_data=content,
            file_name=unique_filename,
            content_type=file.content_type
        )
        return {"image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

