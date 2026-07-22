from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings


class StorageService:
    def save_upload(self, inspection_id: int, upload: UploadFile) -> str:
        upload_root = Path(settings.upload_dir)
        inspection_dir = upload_root / str(inspection_id)
        inspection_dir.mkdir(parents=True, exist_ok=True)

        suffix = Path(upload.filename or "upload.bin").suffix
        file_name = f"{uuid4()}{suffix}"
        file_path = inspection_dir / file_name

        with file_path.open("wb") as output:
            output.write(upload.file.read())

        return str(file_path)


storage_service = StorageService()
