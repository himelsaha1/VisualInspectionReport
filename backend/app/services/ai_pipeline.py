import base64
import json
import logging
import re
from pathlib import Path

import google.generativeai as genai

from app.core.config import settings
from app.db.models.inspection import Inspection

logger = logging.getLogger(__name__)

# ── Model ──────────────────────────────────────────────────────────────────────
# gemini-2.0-flash: significantly better visual reasoning than 1.5-flash,
# same price tier, much stronger at industrial/technical image understanding.
_MODEL_NAME = "gemini-2.0-flash"

# ── Prompt ─────────────────────────────────────────────────────────────────────
# Domain-specific, few-shot engineered prompt for industrial equipment inspection.
_ANALYSIS_PROMPT = """
You are an expert industrial equipment inspector with 20+ years of experience
inspecting pumps, pipes, tanks, valves, motors, conveyors, and structural steel
in oil & gas, manufacturing, and utilities facilities.

Analyse the provided photo(s) carefully and identify ALL visible defects, damage,
wear, or maintenance issues. Be thorough — technicians rely on your report to
prioritise maintenance work and ensure safety.

DEFECT TAXONOMY (use these exact labels where applicable):
- rust              : surface oxidation / rust staining
- corrosion         : active corrosion, pitting, or material loss
- crack             : visible crack in metal, weld, or structural component
- fracture          : full break or fracture
- oil_leak          : oil seepage, staining, or pooling
- water_ingress     : water damage, moisture staining, flooding evidence
- deformation       : bending, buckling, warping, or impact damage
- wear              : surface wear, erosion, abrasion marks
- coating_damage    : paint peeling, blister, coating failure
- loose_fastener    : loose bolts, missing nuts, unsecured fittings
- misalignment      : visible misalignment of components
- fouling           : debris, scale, biological growth, blockage
- overheating       : heat discolouration, scorch marks, thermal damage
- seal_failure      : damaged gasket, seal, or O-ring evidence
- structural_damage : general structural integrity concern

SEVERITY GUIDELINES:
- high   : immediate safety risk, operational failure likely, stop and fix now
- medium : degradation in progress, schedule repair within 7 days
- low    : early-stage issue, monitor and schedule at next maintenance window

CONFIDENCE GUIDELINES:
- 0.90–1.00 : clearly visible, unambiguous
- 0.70–0.89 : likely present, some visual uncertainty
- 0.50–0.69 : possible, limited visibility or ambiguous image
- below 0.5 : do not report

BOUNDING BOX GUIDELINES:
- Estimate [xmin, ymin, width, height] as fractions of image dimensions (0.0–1.0)
- Top-left of image is [0,0], bottom-right is [1,1]
- Make boxes tight around the defect area, not the whole object

FEW-SHOT EXAMPLES of good output:

Example 1 — pipe with rust and crack:
{
  "condition": "Poor",
  "equipment_type": "pipe",
  "summary": "The pipe section shows significant surface rust covering approximately 30% of the visible surface near the weld joint. A hairline crack is visible at the 3 o'clock position of the weld seam, approximately 50mm in length. Immediate inspection and repair of the crack is required to prevent failure under operating pressure.",
  "findings": [
    {
      "label": "crack",
      "confidence": 0.92,
      "severity": "high",
      "description": "Hairline crack at weld seam, approximately 50mm long at the 3 o'clock position",
      "bbox": [0.45, 0.30, 0.20, 0.10]
    },
    {
      "label": "rust",
      "confidence": 0.95,
      "severity": "medium",
      "description": "Surface rust covering approximately 30% of pipe exterior near the weld joint",
      "bbox": [0.30, 0.20, 0.45, 0.60]
    }
  ],
  "recommendations": [
    "Immediately isolate and inspect the weld crack — do not pressurise until assessed by a qualified inspector.",
    "Perform ultrasonic thickness testing around the weld area to check for subsurface cracking.",
    "Clean and treat rusted surface with rust converter, then apply protective coating.",
    "Schedule full weld inspection per applicable standard (e.g. API 570)."
  ]
}

Example 2 — pump with no visible defects:
{
  "condition": "Good",
  "equipment_type": "pump",
  "summary": "The pump appears to be in good condition with no visible defects, leaks, or signs of wear. Surfaces are clean and paint is intact.",
  "findings": [],
  "recommendations": [
    "Continue routine maintenance schedule.",
    "Monitor vibration levels and bearing temperatures at next inspection."
  ]
}

NOW analyse the provided image(s). Return ONLY a valid JSON object with NO
markdown fences, NO explanation text, NOTHING outside the JSON.

Required output structure:
{
  "condition": "<Good|Fair|Poor>",
  "equipment_type": "<type of equipment visible>",
  "summary": "<3–5 sentence detailed plain-English summary for the maintenance team>",
  "findings": [
    {
      "label": "<defect label from taxonomy above>",
      "confidence": <float 0.50–1.00>,
      "severity": "<high|medium|low>",
      "description": "<precise description of location, extent, and nature of the defect>",
      "bbox": [<xmin>, <ymin>, <width>, <height>]
    }
  ],
  "recommendations": [
    "<specific, actionable maintenance recommendation>"
  ]
}
"""


def _fallback_analysis(inspection: Inspection, reason: str = "") -> dict:
    """Clearly-labelled stub when Gemini is unavailable."""
    logger.warning("Gemini unavailable (%s) — stub for inspection %s", reason, inspection.id)
    findings = [{
        "label": "ai_unavailable",
        "confidence": 1.0,
        "severity": "low",
        "description": reason or "AI analysis not configured — add GEMINI_API_KEY to .env",
        "bbox": [0.0, 0.0, 0.0, 0.0],
    }]
    return {
        "condition": "Unknown",
        "findings_json": json.dumps(findings),
        "recommendations_json": json.dumps([
            "Add GEMINI_API_KEY to your .env file and restart the backend to enable AI analysis."
        ]),
        "summary": f"AI analysis unavailable: {reason or 'GEMINI_API_KEY not configured.'}",
    }


def _parse_gemini_response(text: str) -> dict:
    """Robustly extract JSON from Gemini's response."""
    # Strip markdown fences
    clean = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    # If there's extra text before/after the JSON object, extract just the object
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if match:
        clean = match.group(0)
    return json.loads(clean)


class AiPipelineService:
    def __init__(self) -> None:
        self._client_ready = False
        if settings.gemini_api_key:
            try:
                genai.configure(api_key=settings.gemini_api_key)
                self._model = genai.GenerativeModel(
                    _MODEL_NAME,
                    generation_config=genai.GenerationConfig(
                        temperature=0.1,        # low = more deterministic / factual
                        top_p=0.8,
                        max_output_tokens=2048,
                    ),
                )
                self._client_ready = True
                logger.info("Gemini AI pipeline ready (model: %s)", _MODEL_NAME)
            except Exception as exc:
                logger.error("Failed to initialise Gemini client: %s", exc)
        else:
            logger.warning("GEMINI_API_KEY not set — AI pipeline in stub mode.")

    def analyze(self, inspection: Inspection) -> dict:
        if not self._client_ready:
            return _fallback_analysis(inspection, "GEMINI_API_KEY not configured")

        # Collect uploaded images for this inspection
        image_parts = []
        for img in inspection.images:
            path = Path(img.file_path)
            if not path.exists():
                logger.warning("Image file not found: %s", path)
                continue
            mime = img.content_type or "image/jpeg"
            with path.open("rb") as fh:
                data = base64.b64encode(fh.read()).decode("utf-8")
            image_parts.append({"mime_type": mime, "data": data})

        if not image_parts:
            return _fallback_analysis(inspection, "No images found for this inspection")

        # Add equipment context to the prompt if we have a name
        context = ""
        if inspection.equipment_name:
            context = f"\nEQUIPMENT CONTEXT: This is a '{inspection.equipment_name}'.\n"

        try:
            parts: list = [_ANALYSIS_PROMPT + context] + [
                {"inline_data": ip} for ip in image_parts
            ]
            response = self._model.generate_content(parts)
            raw = _parse_gemini_response(response.text)

            findings = []
            for f in raw.get("findings", []):
                confidence = float(f.get("confidence", 0.5))
                if confidence < 0.5:
                    continue  # filter out low-confidence guesses
                findings.append({
                    "label": str(f.get("label", "unknown")),
                    "confidence": confidence,
                    "severity": str(f.get("severity", "medium")),
                    "description": str(f.get("description", "")),
                    "bbox": f.get("bbox", [0.0, 0.0, 0.0, 0.0]),
                })

            recommendations = [str(r) for r in raw.get("recommendations", [])]
            condition = str(raw.get("condition", "Fair"))
            equipment_type = str(raw.get("equipment_type", "equipment"))
            summary = str(raw.get("summary", ""))

            logger.info(
                "Gemini analysis complete — inspection=%s condition=%s findings=%d equipment=%s",
                inspection.id, condition, len(findings), equipment_type,
            )

            return {
                "condition": condition,
                "findings_json": json.dumps(findings),
                "recommendations_json": json.dumps(recommendations),
                "summary": summary,
            }

        except json.JSONDecodeError as exc:
            logger.error("Gemini returned invalid JSON for inspection %s: %s", inspection.id, exc)
            logger.debug("Raw response: %s", response.text if 'response' in dir() else "N/A")
            return _fallback_analysis(inspection, "AI returned unstructured response — retry")
        except Exception as exc:
            logger.error("Gemini analysis failed for inspection %s: %s", inspection.id, exc)
            return _fallback_analysis(inspection, str(exc))


ai_pipeline_service = AiPipelineService()
