from typing import List, Optional

from pydantic import BaseModel


class InspectionCreate(BaseModel):
    asset_id: str
    equipment_name: Optional[str] = None
    technician_name: Optional[str] = None


class InspectionRead(BaseModel):
    id: int
    asset_id: str
    equipment_name: Optional[str] = None
    technician_name: Optional[str] = None
    status: str
    summary: Optional[str] = None

    class Config:
        from_attributes = True


class DetectionRead(BaseModel):
    label: str
    confidence: float
    severity: str


class ReportRead(BaseModel):
    inspection_id: int
    condition: Optional[str] = None
    findings: List[DetectionRead]
    recommendations: List[str]
    summary: Optional[str] = None
    pdf_path: Optional[str] = None
