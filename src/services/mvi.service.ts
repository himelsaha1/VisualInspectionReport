/**
 * mvi.service.ts — Maximo Visual Intelligence API service
 *
 * STUB MODE: returns mock inference results with a simulated delay.
 *
 * TODO: replace stub with real MVI API call:
 *   POST {VITE_MVI_BASE_URL}/api/v1/deployment/{deploymentId}/infer
 *   Headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
 *   Body: FormData with key "files" containing the image(s)
 *   Docs: https://www.ibm.com/docs/en/masv-and-l/maximo-vi/cd?topic=overview-rest-apis
 */

import type { MviInferenceResult } from '@/types'
import mockResults from '@/mock-data/mvi-inference.json'
import { mockDelay } from './utils'

export async function analyzeImage(
  _file: File,
  inspectionId: string
): Promise<MviInferenceResult> {
  // STUB: simulate MVI inference latency (1200–2000ms)
  await mockDelay(1200 + Math.random() * 800)

  // Pick a random mock result and bind it to this inspection
  const base = mockResults[Math.floor(Math.random() * mockResults.length)]
  return {
    ...base,
    id: `mvi-${Date.now()}`,
    inspectionId,
    processedAt: new Date().toISOString(),
  } as MviInferenceResult
}
