/**
 * inspection.service.ts — Inspection CRUD service
 *
 * Backed by the FastAPI backend at VITE_API_BASE_URL.
 * The API uses snake_case IDs (integers); this service maps them to
 * the frontend's camelCase string-ID Inspection type for backwards compat.
 */

import type { Inspection, InspectionStatus, InspectionType } from '@/types'
import {
  apiCreateInspection,
  apiListInspections,
  apiGetInspection,
  apiUploadImage,
  type ApiInspectionRead,
} from './api'

// ── Mapping helpers ───────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

/** Convert a backend InspectionRead to the frontend Inspection type. */
function toInspection(r: ApiInspectionRead): Inspection {
  const imageUrls = r.images.map(img => {
    // Prefer a fully-qualified URL if available, else proxy via /uploads
    if (img.file_path.startsWith('http')) return img.file_path
    // file_path is relative like "backend/uploads/3/abc.jpg"
    // Strip the leading "backend/" prefix if present then build a URL
    const rel = img.file_path.replace(/^backend\//, '')
    return `${API_BASE}/${rel}`
  })

  return {
    id: String(r.id),
    assetId: r.asset_id,
    assetName: r.equipment_name ?? r.asset_id,
    assetNum: r.asset_id,
    inspectionType: 'visual' as InspectionType,
    status: (r.status as InspectionStatus) ?? 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: r.technician_name ?? 'unknown',
    imageUrls,
    summary: r.summary ?? undefined,
  } as Inspection & { summary?: string }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getInspections(): Promise<Inspection[]> {
  const records = await apiListInspections()
  return records.map(toInspection)
}

export async function getInspection(id: string): Promise<Inspection | null> {
  try {
    const record = await apiGetInspection(id)
    return toInspection(record)
  } catch {
    return null
  }
}

export interface CreateInspectionInput {
  assetId: string
  assetName: string
  assetNum: string
  inspectionType: InspectionType
  createdBy: string
  imageFiles?: File[]   // actual File objects to upload
  imageUrls?: string[]  // kept for type compat but ignored (files are uploaded directly)
  notes?: string
}

/**
 * Creates the inspection record in the backend, then uploads all images.
 * Returns the created Inspection with image URLs pointing at the backend.
 */
export async function createInspection(
  input: CreateInspectionInput
): Promise<Inspection> {
  // 1. Create the record
  const record = await apiCreateInspection({
    asset_id: input.assetNum || input.assetId,
    equipment_name: input.assetName,
    technician_name: input.createdBy,
  })

  // 2. Upload each image file
  const imageUrls: string[] = []
  for (const file of input.imageFiles ?? []) {
    const result = await apiUploadImage(record.id, file)
    imageUrls.push(result.image_url)
  }

  return {
    id: String(record.id),
    assetId: input.assetId,
    assetName: input.assetName,
    assetNum: input.assetNum,
    inspectionType: input.inspectionType,
    status: 'in-progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: input.createdBy,
    imageUrls,
    notes: input.notes,
  }
}

export async function updateInspection(
  id: string,
  patch: Partial<Omit<Inspection, 'id' | 'createdAt'>>
): Promise<Inspection> {
  // The current backend doesn't have a PATCH endpoint yet; optimistically
  // return a merged object so the UI stays consistent.
  const current = await getInspection(id)
  if (!current) throw new Error(`Inspection ${id} not found`)
  return { ...current, ...patch, updatedAt: new Date().toISOString() }
}

export async function updateInspectionStatus(
  id: string,
  status: InspectionStatus
): Promise<Inspection> {
  return updateInspection(id, { status })
}
