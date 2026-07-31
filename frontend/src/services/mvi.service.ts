/**
 * mvi.service.ts — Maximo Visual Intelligence service
 *
 * Sends the inspection image to the FastAPI backend which runs the AI pipeline
 * and returns structured defect findings.  The backend's `/analyze` endpoint
 * currently runs a stub pipeline; swap in a real MVI API call inside
 * backend/app/services/ai_pipeline.py when credentials are available.
 */

import type { MviInferenceResult } from '@/types'
import { apiAnalyzeInspection } from './api'

/**
 * Analyze an inspection's uploaded images by calling the backend `/analyze`
 * endpoint.  The `_file` parameter is kept for API compatibility with callers
 * that already hold the File object; actual image bytes were uploaded during
 * createInspection() so the backend already has them.
 */
export async function analyzeImage(
  _file: File,
  inspectionId: string
): Promise<MviInferenceResult> {
  const report = await apiAnalyzeInspection(inspectionId)

  return {
    id: `mvi-${inspectionId}-${Date.now()}`,
    inspectionId,
    modelName: 'MVI-Inspection-Pipeline',
    modelVersion: '1.0',
    processedAt: new Date().toISOString(),
    detections: report.findings.map(f => ({
      label: f.label,
      // backend returns 0–1 fraction; frontend type uses 0–100 percentage
      confidence: Math.round(f.confidence * 100),
      severity: f.severity as 'high' | 'medium' | 'low',
      bbox: f.bbox,
    })),
    rawResponse: report,
  }
}
