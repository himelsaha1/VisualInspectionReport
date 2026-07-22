from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    asset_id: Mapped[str] = mapped_column(String(100), index=True)
    equipment_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    technician_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    images: Mapped[List["InspectionImage"]] = relationship(back_populates="inspection", cascade="all, delete-orphan")
    report: Mapped[Optional["InspectionReport"]] = relationship(back_populates="inspection", cascade="all, delete-orphan")


class InspectionImage(Base):
    __tablename__ = "inspection_images"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    inspection_id: Mapped[int] = mapped_column(ForeignKey("inspections.id"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    inspection: Mapped[Inspection] = relationship(back_populates="images")


class InspectionReport(Base):
    __tablename__ = "inspection_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    inspection_id: Mapped[int] = mapped_column(ForeignKey("inspections.id"), unique=True)
    condition: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    findings_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommendations_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    inspection: Mapped[Inspection] = relationship(back_populates="report")
