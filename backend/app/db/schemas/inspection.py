from typing import List, Optional, Tuple

from pydantic import BaseModel


class InspectionCreate(BaseModel):
    asset_id: str
    equipment_name: Optional[str] = None
    technician_name: Optional[str] = None


class ImageRead(BaseModel):
    id: int
    file_name: str
    file_path: str

    class Config:
        from_attributes = True


class InspectionRead(BaseModel):
    id: int
    asset_id: str
    equipment_name: Optional[str] = None
    technician_name: Optional[str] = None
    status: str
    summary: Optional[str] = None
    images: List[ImageRead] = []

    class Config:
        from_attributes = True


class DetectionRead(BaseModel):
    label: str
    confidence: float
    severity: str
    # Normalised [xmin, ymin, width, height] 0–1
    bbox: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)


class ReportRead(BaseModel):
    inspection_id: int
    condition: Optional[str] = None
    findings: List[DetectionRead]
    recommendations: List[str]
    summary: Optional[str] = None
    pdf_path: Optional[str] = None
