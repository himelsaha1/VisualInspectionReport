// Domain types for the Maximo Visual Inspections application

// ─── Asset ────────────────────────────────────────────────────────────────────

export interface Asset {
  id: string
  name: string
  assetNum: string
  location: string
  assetType: AssetType
  description: string
}

export type AssetType = 'pump' | 'pipe' | 'tank' | 'valve' | 'conveyor' | 'motor'

// ─── Inspection ────────────────────────────────────────────────────────────────

export type InspectionStatus =
  | 'pending'
  | 'in-progress'
  | 'complete'
  | 'failed'
  | 'approved'
  | 'rejected'

export type InspectionType = 'visual' | 'thermal' | 'structural'

export interface Inspection {
  id: string
  assetId: string
  assetName: string
  assetNum: string
  inspectionType: InspectionType
  status: InspectionStatus
  createdAt: string        // ISO 8601
  updatedAt: string        // ISO 8601
  createdBy: string
  imageUrls: string[]      // data URLs or object URLs stored in stub
  mviResultId?: string     // references MviInferenceResult.id
  workOrderId?: string     // populated after WO creation
  notes?: string
}

// ─── MVI Inference ────────────────────────────────────────────────────────────

export interface Detection {
  label: string
  confidence: number       // 0–100
  /** Normalised [xmin, ymin, width, height] 0–1 */
  bbox: [number, number, number, number]
  severity: 'high' | 'medium' | 'low'
}

export interface MviInferenceResult {
  id: string
  inspectionId: string
  modelName: string
  modelVersion: string
  detections: Detection[]
  processedAt: string      // ISO 8601
  /** Raw response preserved for real API wiring */
  rawResponse?: unknown
}

// ─── Work Order ───────────────────────────────────────────────────────────────

export type WorkOrderPriority = '1' | '2' | '3' | '4'  // 1 = emergency, 4 = low

export interface WorkOrderPayload {
  description: string
  assetId: string
  assetNum: string
  location: string
  priority: WorkOrderPriority
  dueDate: string          // ISO 8601 date
  reportedBy: string
  inspectionId: string
  notes?: string
}

export interface WorkOrderResult {
  woNum: string
  status: 'created' | 'failed'
  message?: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: 'technician' | 'supervisor' | 'admin'
}
