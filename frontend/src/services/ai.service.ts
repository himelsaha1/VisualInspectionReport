/**
 * ai.service.ts — Conversational AI service stub
 *
 * Simulates an LLM-backed inspection assistant that:
 *  1. Analyses an uploaded photo and description to identify the asset + inspection type
 *  2. Drives a short clarifying Q&A to fill in required fields
 *  3. Returns a fully resolved inspection record for review
 *
 * TODO: replace with real watsonx.ai or Azure OpenAI call:
 *   POST {VITE_AI_BASE_URL}/v1/text/generation
 *   Headers: { Authorization: `Bearer ${token}` }
 */

import type { Asset, InspectionType } from '@/types'
import mockAssets from '@/mock-data/assets.json'
import { mockDelay } from './utils'

// ─── Public types ─────────────────────────────────────────────────────────────

export type AssetResolutionConfidence = 'high' | 'low' | 'none'

export interface AssetResolution {
  confidence: AssetResolutionConfidence
  asset: Asset | null
  /** Ranked candidates for manual fallback */
  candidates: Asset[]
  inferredInspectionType: InspectionType
}

export interface ChatMessage {
  id: string
  role: 'ai' | 'tech'
  text: string
  timestamp: string
  /** If true, show a "Not sure / Skip" affordance */
  skippable?: boolean
  /** Field key this message is asking about */
  fieldKey?: string
}

export interface ReviewRecord {
  assetId: string
  assetName: string
  assetNum: string
  location: string
  inspectionType: InspectionType
  findings: string
  priority: string
  notes: string
  /** Fields that were skipped — flagged for manual review */
  flaggedFields: string[]
}

// ─── Step 1: Analyse photo + description → resolve asset ──────────────────────

// Keyword → asset hint mapping (simulates visual/text signal matching)
const KEYWORD_ASSET_HINTS: { keywords: string[]; assetId: string }[] = [
  { keywords: ['pump', 'impeller', 'suction', 'discharge', 'boiler feed'], assetId: 'asset-001' },
  { keywords: ['cooling', 'cooling water', 'cwp'], assetId: 'asset-002' },
  { keywords: ['pipe', 'steam', 'pipeline', 'line'], assetId: 'asset-003' },
  { keywords: ['tank', 'storage', 'chemical', 'vessel'], assetId: 'asset-004' },
  { keywords: ['water tank', 'process water'], assetId: 'asset-005' },
  { keywords: ['valve', 'gate valve', 'gv'], assetId: 'asset-006' },
  { keywords: ['conveyor', 'belt', 'conveyer'], assetId: 'asset-007' },
  { keywords: ['motor', 'drive', 'electric'], assetId: 'asset-008' },
  { keywords: ['lube', 'lube oil', 'oil pump'], assetId: 'asset-009' },
  { keywords: ['header', 'discharge pipe', 'dph'], assetId: 'asset-010' },
]

const KEYWORD_TYPE_HINTS: { keywords: string[]; type: InspectionType }[] = [
  { keywords: ['thermal', 'heat', 'temperature', 'hot spot', 'infrared', 'ir'], type: 'thermal' },
  { keywords: ['structural', 'crack', 'fracture', 'weld', 'deformation', 'bend'], type: 'structural' },
]

function inferInspectionType(description: string): InspectionType {
  const lower = description.toLowerCase()
  for (const { keywords, type } of KEYWORD_TYPE_HINTS) {
    if (keywords.some(k => lower.includes(k))) return type
  }
  return 'visual'
}

export async function resolveAsset(
  description: string
): Promise<AssetResolution> {
  // STUB: simulate AI processing delay
  await mockDelay(1400 + Math.random() * 600)

  const lower = description.toLowerCase()
  const assets = mockAssets as Asset[]

  // Score each hint
  const scores: Record<string, number> = {}
  for (const { keywords, assetId } of KEYWORD_ASSET_HINTS) {
    scores[assetId] = keywords.filter(k => lower.includes(k)).length
  }

  const ranked = assets
    .map(a => ({ asset: a, score: scores[a.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)

  const top = ranked[0]
  const inferredType = inferInspectionType(description)

  if (!description.trim() || top.score === 0) {
    return {
      confidence: 'none',
      asset: null,
      candidates: assets.slice(0, 5),
      inferredInspectionType: inferredType,
    }
  }

  if (top.score >= 2) {
    return {
      confidence: 'high',
      asset: top.asset,
      candidates: ranked.slice(1, 4).map(r => r.asset),
      inferredInspectionType: inferredType,
    }
  }

  return {
    confidence: 'low',
    asset: top.asset,
    candidates: ranked.slice(0, 5).map(r => r.asset),
    inferredInspectionType: inferredType,
  }
}

// ─── Step 2: Generate first AI message from visual analysis ───────────────────

const FINDINGS_BY_TYPE: Record<string, string[]> = {
  'pump': [
    'surface corrosion on the pump casing near the inlet flange',
    'paint deterioration on the pump housing — possible moisture ingress',
    'visible oil seepage around the mechanical seal area',
  ],
  'pipe': [
    'a hairline crack along the pipe weld seam',
    'surface corrosion and pitting on the pipe exterior',
    'discoloration and coating blister near the support bracket',
  ],
  'tank': [
    'pitting corrosion on the tank shell near the base',
    'coating blister and surface staining on the tank exterior',
    'a small dent on the lower tank wall — possible impact damage',
  ],
  'valve': [
    'corrosion on the valve stem and bonnet area',
    'visible leak staining around the valve packing gland',
    'surface rust on the valve body and handwheel',
  ],
  'conveyor': [
    'wear and fraying on the conveyor belt surface',
    'misalignment visible on the conveyor return rollers',
    'debris accumulation under the conveyor belt',
  ],
  'motor': [
    'overheating discoloration on the motor housing',
    'vibration-induced wear marks on the motor mounting feet',
    'moisture ingress staining near the terminal box',
  ],
}

export async function generateFirstMessage(
  resolution: AssetResolution,
  description: string
): Promise<string> {
  await mockDelay(800)

  const assetType = resolution.asset?.assetType ?? 'pump'
  const findings = FINDINGS_BY_TYPE[assetType] ?? FINDINGS_BY_TYPE['pump']
  const finding = findings[Math.floor(Math.random() * findings.length)]
  const assetLabel = resolution.asset
    ? `${resolution.asset.name} (${resolution.asset.assetNum})`
    : 'the asset'

  const descPart = description.trim()
    ? ` Based on your description, this looks like a ${resolution.inferredInspectionType} inspection.`
    : ''

  return `I've analysed the photo of ${assetLabel}. I can see ${finding}.${descPart} I have a couple of quick questions to complete the inspection record.`
}

// ─── Step 3: Clarifying Q&A flow ─────────────────────────────────────────────

export type ClarifyingFieldKey = 'priority' | 'location' | 'findings' | 'notes'

const CLARIFYING_QUESTIONS: {
  fieldKey: ClarifyingFieldKey
  question: string
  skippable: boolean
}[] = [
  {
    fieldKey: 'priority',
    question: 'How urgent is this? Is it an emergency, urgent, normal priority — or not sure yet?',
    skippable: true,
  },
  {
    fieldKey: 'findings',
    question: 'Can you describe the defect in a bit more detail? For example: how large is the affected area, and is it getting worse?',
    skippable: true,
  },
  {
    fieldKey: 'notes',
    question: 'Any other notes for the maintenance team — safety concerns, access restrictions, or related issues nearby?',
    skippable: true,
  },
]

export function getClarifyingQuestions() {
  return CLARIFYING_QUESTIONS
}

// ─── Step 4: Parse tech reply → extract field value ───────────────────────────

const PRIORITY_KEYWORDS: { keywords: string[]; value: string }[] = [
  { keywords: ['emergency', 'critical', 'immediate', 'now', '1'], value: '1' },
  { keywords: ['urgent', 'soon', 'asap', '2'], value: '2' },
  { keywords: ['normal', 'routine', 'standard', '3'], value: '3' },
  { keywords: ['low', 'minor', 'whenever', '4'], value: '4' },
]

export function parsePriorityFromText(text: string): string {
  const lower = text.toLowerCase()
  for (const { keywords, value } of PRIORITY_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) return value
  }
  return '3' // default to normal
}
