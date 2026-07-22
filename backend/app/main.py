from fastapi import FastAPI

from app.api.routes.inspections import router as inspections_router
from app.core.config import settings
from app.core.database import Base, engine
from app.db.models.inspection import Inspection, InspectionImage, InspectionReport

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name)
app.include_router(inspections_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
