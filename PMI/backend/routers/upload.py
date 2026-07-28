import uuid
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from utils import storage
from utils.audit import audit_action
from utils.dependency import require_permission

router = APIRouter(tags=['Upload'])

@router.post("/upload", dependencies=[Depends(require_permission("upload:write"))])
@audit_action(module="Product", action_type="UPLOAD_IMAGE")
async def upload_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
        file_ext = file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        
        image_url = storage.upload_file(
            file_data=content,
            file_name=unique_filename,
            content_type=file.content_type
        )
        return {"image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")
