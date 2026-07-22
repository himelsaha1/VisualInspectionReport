import json

from app.db.models.inspection import Inspection, InspectionReport


class AiPipelineService:
    def analyze(self, inspection: Inspection) -> dict:
        findings = [
            {
                "label": "rust",
                "confidence": 0.89,
                "severity": "medium",
            },
            {
                "label": "crack",
                "confidence": 0.96,
                "severity": "high",
            },
        ]
        recommendations = [
            "Repair visible crack within 7 days.",
            "Clean and treat corroded surface.",
        ]
        summary = (
            f"Inspection for asset {inspection.asset_id} found high-confidence structural and surface defects."
        )

        return {
            "condition": "Fair",
            "findings_json": json.dumps(findings),
            "recommendations_json": json.dumps(recommendations),
            "summary": summary,
        }


ai_pipeline_service = AiPipelineService()
