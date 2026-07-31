/**
 * api.ts — Typed HTTP client for the FastAPI backend
 *
 * All calls go through /api (proxied to http://localhost:8000 in dev via vite.config.ts).
 * Swap VITE_API_BASE_URL in .env to point at a deployed backend.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function upload<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Inspection CRUD ───────────────────────────────────────────────────────────

export interface ApiImageRead {
  id: number
  file_name: string
  file_path: string
}

export interface ApiInspectionRead {
  id: number
  asset_id: string
  equipment_name: string | null
  technician_name: string | null
  status: string
  summary: string | null
  images: ApiImageRead[]
}

export interface ApiInspectionCreate {
  asset_id: string
  equipment_name?: string
  technician_name?: string
}

export function apiCreateInspection(payload: ApiInspectionCreate) {
  return request<ApiInspectionRead>('/api/inspections', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function apiListInspections() {
  return request<ApiInspectionRead[]>('/api/inspections')
}

export function apiGetInspection(id: number | string) {
  return request<ApiInspectionRead>(`/api/inspections/${id}`)
}

// ── Image upload ──────────────────────────────────────────────────────────────

export interface ApiImageUploadResult {
  id: number
  inspection_id: number
  file_path: string
  image_url: string
}

export function apiUploadImage(inspectionId: number, file: File) {
  const form = new FormData()
  form.append('file', file)
  return upload<ApiImageUploadResult>(`/api/inspections/${inspectionId}/images`, form)
}

// ── AI Analysis ───────────────────────────────────────────────────────────────

export interface ApiDetection {
  label: string
  confidence: number
  severity: 'high' | 'medium' | 'low'
  bbox: [number, number, number, number]
}

export interface ApiReportRead {
  inspection_id: number
  condition: string | null
  findings: ApiDetection[]
  recommendations: string[]
  summary: string | null
  pdf_path: string | null
}

export function apiAnalyzeInspection(inspectionId: number | string) {
  return request<ApiReportRead>(`/api/inspections/${inspectionId}/analyze`, {
    method: 'POST',
    body: '{}',
  })
}

export function apiGetResults(inspectionId: number | string) {
  return request<ApiReportRead>(`/api/inspections/${inspectionId}/results`)
}
