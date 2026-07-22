# VisualInspectionReport backend

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

## Endpoints

- `GET /health`
- `POST /api/inspections`
- `GET /api/inspections`
- `GET /api/inspections/{inspection_id}`
- `POST /api/inspections/{inspection_id}/images`
- `POST /api/inspections/{inspection_id}/analyze`
- `GET /api/inspections/{inspection_id}/results`

## Notes

- Current AI analysis is a placeholder service in `app/services/ai_pipeline.py`.
- Uploaded files are stored locally under `backend/uploads`.
- Generated PDFs are stored under `backend/generated-reports`.
