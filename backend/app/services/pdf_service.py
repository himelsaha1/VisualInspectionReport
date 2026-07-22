import json
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


class PdfService:
    def generate_report_pdf(self, inspection_id: int, summary: str, findings_json: str, output_dir: str) -> str:
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        file_path = Path(output_dir) / f"inspection-{inspection_id}.pdf"
        findings = json.loads(findings_json)

        pdf = canvas.Canvas(str(file_path), pagesize=letter)
        pdf.setTitle(f"Inspection Report {inspection_id}")
        pdf.drawString(72, 750, f"Inspection Report #{inspection_id}")
        pdf.drawString(72, 730, f"Summary: {summary}")
        pdf.drawString(72, 700, "Findings:")

        y = 680
        for finding in findings:
            pdf.drawString(
                90,
                y,
                f"- {finding['label']} ({finding['severity']}) confidence={finding['confidence']}",
            )
            y -= 20

        pdf.save()
        return str(file_path)


pdf_service = PdfService()
