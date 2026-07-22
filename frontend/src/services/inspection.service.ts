/**
 * inspection.service.ts — Inspection CRUD service
 *
 * STUB MODE: persists inspection records to localStorage so state
 * survives page reloads during demos.
 *
 * TODO: replace localStorage with Maximo OSLC inspection object set calls:
 *   List:   GET    {VITE_MAXIMO_BASE_URL}/maximo/oslc/os/mxinspectionresult
 *   Get:    GET    {VITE_MAXIMO_BASE_URL}/maximo/oslc/os/mxinspectionresult/{id}
 *   Create: POST   {VITE_MAXIMO_BASE_URL}/maximo/oslc/os/mxinspectionresult
 *   Update: PATCH  {VITE_MAXIMO_BASE_URL}/maximo/oslc/os/mxinspectionresult/{id}
 */

import type { Inspection, InspectionStatus, InspectionType } from '@/types'
import seedData from '@/mock-data/inspections.json'
import { mockDelay, generateId } from './utils'

const STORAGE_KEY = 'mvi-inspections'

function loadFromStorage(): Inspection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Inspection[]
  } catch {
    // ignore parse errors
  }
  // Seed with mock data on first load
  const seed = seedData as Inspection[]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  return seed
}

function saveToStorage(records: Inspection[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export async function getInspections(): Promise<Inspection[]> {
  await mockDelay(400)
  return loadFromStorage()
}

export async function getInspection(id: string): Promise<Inspection | null> {
  await mockDelay(200)
  const records = loadFromStorage()
  return records.find(r => r.id === id) ?? null
}

export interface CreateInspectionInput {
  assetId: string
  assetName: string
  assetNum: string
  inspectionType: InspectionType
  createdBy: string
  imageUrls?: string[]
  notes?: string
}

export async function createInspection(
  input: CreateInspectionInput
): Promise<Inspection> {
  await mockDelay(300)
  const now = new Date().toISOString()
  const record: Inspection = {
    id: generateId('insp'),
    ...input,
    imageUrls: input.imageUrls ?? [],
    status: 'in-progress',
    createdAt: now,
    updatedAt: now,
  }
  const records = loadFromStorage()
  records.unshift(record)
  saveToStorage(records)
  return record
}

export async function updateInspection(
  id: string,
  patch: Partial<Omit<Inspection, 'id' | 'createdAt'>>
): Promise<Inspection> {
  await mockDelay(200)
  const records = loadFromStorage()
  const idx = records.findIndex(r => r.id === id)
  if (idx === -1) throw new Error(`Inspection ${id} not found`)

  const updated: Inspection = {
    ...records[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  records[idx] = updated
  saveToStorage(records)
  return updated
}

export async function updateInspectionStatus(
  id: string,
  status: InspectionStatus
): Promise<Inspection> {
  return updateInspection(id, { status })
}
