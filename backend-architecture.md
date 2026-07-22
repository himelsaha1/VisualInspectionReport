# Backend architecture for Maximo Visual Inspection Report

## Goal

Build a backend that accepts technician images, runs AI analysis, generates a structured inspection result, writes inspection/report data, and integrates with Maximo.

## Recommended stack

- API framework: FastAPI
- Workflow orchestration: LangGraph
- Object detection: Ultralytics YOLO
- Image processing: OpenCV
- OCR: Tesseract or a managed OCR service
- Database: PostgreSQL
- ORM: SQLAlchemy
- File storage: S3-compatible object storage
- Auth: JWT
- PDF generation: ReportLab
- Background jobs: Celery or FastAPI background tasks for the first version

## Suggested backend folder structure

```text
backend/
  app/
    api/
      routes/
        auth.py
        inspections.py
        reports.py
        assets.py
        uploads.py
    core/
      config.py
      security.py
      database.py
    db/
      models/
        inspection.py
        technician.py
        equipment.py
        image.py
        report.py
      schemas/
        inspection.py
        report.py
        auth.py
      repositories/
        inspection_repository.py
        report_repository.py
    services/
      ai/
        workflow.py
        vision_agent.py
        ocr_agent.py
        damage_agent.py
        equipment_agent.py
        severity_agent.py
        report_agent.py
      image_processing.py
      storage_service.py
      pdf_service.py
      maximo_service.py
    workers/
      tasks.py
    main.py
  tests/
  requirements.txt
  Dockerfile
```

## Core workflow

```text
Technician uploads image
  -> backend stores original image in object storage
  -> backend creates inspection record in PostgreSQL
  -> backend runs preprocessing with OpenCV
  -> backend runs object detection with YOLO
  -> backend runs OCR for serial numbers / nameplates
  -> backend classifies severity and equipment type
  -> backend sends structured observations to LLM
  -> backend stores generated report JSON and PDF
  -> backend optionally creates or updates Maximo records
```

## Main backend entities

### Inspection
- id
- technician_id
- equipment_id
- status
- overall_condition
- created_at
- updated_at

### InspectionImage
- id
- inspection_id
- storage_key
- original_filename
- content_type
- width
- height

### DefectFinding
- id
- inspection_id
- defect_type
- confidence
- severity
- bounding_box_json

### Report
- id
- inspection_id
- summary
- findings_json
- recommendations_json
- pdf_storage_key
- maximo_workorder_id

### Equipment
- id
- external_asset_id
- name
- serial_number
- location
- equipment_type

### Technician
- id
- email
- display_name
- auth_provider_subject

## Recommended API endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

### Inspections
- `POST /api/inspections`
- `GET /api/inspections`
- `GET /api/inspections/{inspection_id}`
- `POST /api/inspections/{inspection_id}/images`
- `POST /api/inspections/{inspection_id}/analyze`
- `GET /api/inspections/{inspection_id}/results`

### Reports
- `POST /api/inspections/{inspection_id}/report`
- `GET /api/reports/{report_id}`
- `GET /api/reports/{report_id}/pdf`

### Maximo integration
- `POST /api/inspections/{inspection_id}/maximo/work-order`
- `POST /api/inspections/{inspection_id}/maximo/inspection-report`

## Data contracts

### Detection result
```json
{
  "label": "crack",
  "confidence": 0.96,
  "bbox": [0.14, 0.22, 0.31, 0.12],
  "severity": "high"
}
```

### Structured AI output
```json
{
  "equipment": "Transformer",
  "condition": "Fair",
  "serial_number": "123456",
  "defects": [
    {
      "type": "Rust",
      "severity": "Medium",
      "confidence": 0.89
    },
    {
      "type": "Oil Leak",
      "severity": "High",
      "confidence": 0.94
    }
  ],
  "recommendations": [
    "Repair leak within 7 days",
    "Clean and treat corrosion"
  ]
}
```

## Implementation order

1. Create FastAPI service with health check and inspection endpoints.
2. Add PostgreSQL with SQLAlchemy models for inspections, images, findings, and reports.
3. Add object storage upload flow.
4. Add OpenCV preprocessing service.
5. Add YOLO-based detection service.
6. Add OCR extraction.
7. Add LangGraph workflow that combines detection, OCR, severity, and report generation.
8. Add PDF generation.
9. Add Maximo integration service.
10. Move heavy analysis into async workers if latency becomes too high.

## Recommendation for your project

For the first backend version, keep it simple:
- FastAPI
- PostgreSQL
- SQLAlchemy
- S3-compatible storage
- Ultralytics YOLO
- OpenCV
- one LLM report-generation step

Use LangGraph only after the single-pipeline version is working. That gives you a smaller first delivery and a cleaner path to production hardening.
