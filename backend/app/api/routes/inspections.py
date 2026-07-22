import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db.models.inspection import Inspection, InspectionImage, InspectionReport
from app.db.schemas.inspection import InspectionCreate, InspectionRead, ReportRead
from app.services.ai_pipeline import ai_pipeline_service
from app.services.pdf_service import pdf_service
from app.services.storage_service import storage_service

router = APIRouter(prefix="/api/inspections", tags=["inspections"])


@router.post("", response_model=InspectionRead)
def create_inspection(payload: InspectionCreate, db: Session = Depends(get_db)):
    inspection = Inspection(
        asset_id=payload.asset_id,
        equipment_name=payload.equipment_name,
        technician_name=payload.technician_name,
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection


@router.get("", response_model=list[InspectionRead])
def list_inspections(db: Session = Depends(get_db)):
    return db.query(Inspection).order_by(Inspection.created_at.desc()).all()


@router.get("/{inspection_id}", response_model=InspectionRead)
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection


@router.post("/{inspection_id}/images")
def upload_inspection_image(
    inspection_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    inspection = db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    file_path = storage_service.save_upload(inspection_id, file)
    image = InspectionImage(
        inspection_id=inspection.id,
        file_name=file.filename or "upload.bin",
        file_path=file_path,
        content_type=file.content_type,
    )
    db.add(image)
    db.commit()

    return {"inspection_id": inspection_id, "file_path": file_path}


@router.post("/{inspection_id}/analyze", response_model=ReportRead)
def analyze_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    analysis = ai_pipeline_service.analyze(inspection)
    inspection.status = "analyzed"
    inspection.summary = analysis["summary"]

    report = inspection.report or InspectionReport(inspection_id=inspection.id)
    report.condition = analysis["condition"]
    report.findings_json = analysis["findings_json"]
    report.recommendations_json = analysis["recommendations_json"]
    report.pdf_path = pdf_service.generate_report_pdf(
        inspection.id,
        analysis["summary"],
        analysis["findings_json"],
        "backend/generated-reports",
    )

    db.add(report)
    db.add(inspection)
    db.commit()
    db.refresh(report)

    return {
        "inspection_id": inspection.id,
        "condition": report.condition,
        "findings": json.loads(report.findings_json or "[]"),
        "recommendations": json.loads(report.recommendations_json or "[]"),
        "summary": inspection.summary,
        "pdf_path": report.pdf_path,
    }


@router.get("/{inspection_id}/results", response_model=ReportRead)
def get_inspection_results(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.get(Inspection, inspection_id)
    if not inspection or not inspection.report:
        raise HTTPException(status_code=404, detail="Inspection results not found")

    report = inspection.report
    return {
        "inspection_id": inspection.id,
        "condition": report.condition,
        "findings": json.loads(report.findings_json or "[]"),
        "recommendations": json.loads(report.recommendations_json or "[]"),
        "summary": inspection.summary,
        "pdf_path": report.pdf_path,
    }
