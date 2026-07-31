from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api.routes.inspections import router as inspections_router
from app.core.config import settings
from app.core.database import Base, engine
from app.db.models.inspection import Inspection, InspectionImage, InspectionReport

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images at /uploads/<inspection_id>/<filename>
uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

app.include_router(inspections_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
