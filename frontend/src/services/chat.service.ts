/**
 * chat.service.ts — Global persistent AI chat service
 *
 * Context-aware stub that:
 *  1. Knows the current screen / inspection record
 *  2. Detects Q&A intent vs action intent from phrasing
 *  3. Returns natural-language responses for questions
 *  4. Returns structured action descriptors for action requests
 *     (caller is responsible for executing the action)
 *
 * TODO: replace generateReply() with a real watsonx.ai chat call,
 *   passing systemPrompt (built here) + message history as context.
 *   POST {VITE_AI_BASE_URL}/v1/text/chat
 */

import { mockDelay } from './utils'
import { getInspections, getInspection } from './inspection.service'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ChatContext {
  /** Current route pathname, e.g. '/inspections/insp-003/analysis' */
  pathname: string
  /** Inspection ID extracted from the route, if any */
  inspectionId?: string
}

export type GlobalChatRole = 'ai' | 'user'

export interface GlobalChatMessage {
  id: string
  role: GlobalChatRole
  text: string
  timestamp: string
  /** If the message triggered an in-app action, describe it */
  action?: ChatAction
}

export type ChatActionType =
  | 'navigate'
  | 'start_inspection'
  | 'open_inspection'
  | 'open_dashboard'
  | 'open_settings'

export interface ChatAction {
  type: ChatActionType
  /** For navigate: the target path */
  path?: string
  /** Human-readable label for the action that was taken */
  label: string
}

// ── Intent detection ──────────────────────────────────────────────────────────

const ACTION_PATTERNS: { pattern: RegExp; type: ChatActionType; path?: string }[] = [
  { pattern: /\b(start|begin|new|create)\s+(an?\s+)?inspection\b/i, type: 'start_inspection',  path: '/' },
  { pattern: /\b(go to|open|show me)\s+(the\s+)?dashboard\b/i,      type: 'open_dashboard',   path: '/dashboard' },
  { pattern: /\b(go to|open|show me)\s+(the\s+)?settings\b/i,       type: 'open_settings',    path: '/settings' },
  { pattern: /\b(go to|open|show me)\s+(the\s+)?(history|past)\b/i, type: 'navigate',         path: '/inspections' },
]

function detectAction(text: string): { type: ChatActionType; path?: string } | null {
  for (const { pattern, type, path } of ACTION_PATTERNS) {
    if (pattern.test(text)) return { type, path }
  }
  return null
}

// ── Context → screen label ────────────────────────────────────────────────────

function screenLabel(ctx: ChatContext): string {
  const p = ctx.pathname
  if (p === '/')                            return 'New Inspection screen'
  if (p === '/inspections')                 return 'Inspection History screen'
  if (p === '/dashboard')                   return 'Dashboard'
  if (p === '/settings')                    return 'Settings'
  if (p.includes('/analysis'))              return `AI Review screen (inspection ${ctx.inspectionId ?? ''})`
  if (p.includes('/work-order'))            return `Work Order screen (inspection ${ctx.inspectionId ?? ''})`
  return 'current screen'
}

// ── Response generation ───────────────────────────────────────────────────────

async function buildContextSummary(ctx: ChatContext): Promise<string> {
  if (!ctx.inspectionId) return ''
  try {
    const insp = await getInspection(ctx.inspectionId)
    if (!insp) return ''
    return (
      `The user is currently viewing inspection ${insp.id} — asset: ${insp.assetName} ` +
      `(${insp.assetNum}), type: ${insp.inspectionType}, status: ${insp.status}, ` +
      `created: ${new Date(insp.createdAt).toLocaleDateString()}.`
    )
  } catch {
    return ''
  }
}

async function answerQuestion(text: string, ctx: ChatContext): Promise<string> {
  const lower = text.toLowerCase()
  const screen = screenLabel(ctx)

  // ── Inspection-specific questions when on a record ─────────────────────────
  if (ctx.inspectionId) {
    const insp = await getInspection(ctx.inspectionId).catch(() => null)
    if (insp) {
      if (/\b(what|why|how|tell me|explain|describe)\b/.test(lower)) {
        const statusMap: Record<string, string> = {
          'pending':     'waiting to be picked up by a technician',
          'in-progress': 'currently being worked on',
          'complete':    'analysis complete — pending review or approval',
          'approved':    'reviewed and approved, written back to Maximo',
          'failed':      'the MVI analysis failed — re-capture may be needed',
          'rejected':    'flagged as rejected during review',
        }
        const statusExplain = statusMap[insp.status] ?? insp.status
        if (/status|happen|flagg|review|approv/.test(lower)) {
          return (
            `Inspection ${insp.id} for **${insp.assetName}** (${insp.assetNum}) is currently ` +
            `**${statusExplain}**. It was created on ` +
            `${new Date(insp.createdAt).toLocaleDateString()} by ${insp.createdBy}.` +
            (insp.notes ? ` Notes: "${insp.notes}"` : '')
          )
        }
        if (/severity|priority|urgent/.test(lower)) {
          return `This inspection doesn't have a severity field set yet — that gets populated during the AI Review step when the technician confirms or overrides the detected condition.`
        }
        if (/asset|pump|valve|pipe|tank|motor/.test(lower)) {
          return `The asset on this inspection is **${insp.assetName}** — ID ${insp.assetNum}, located at ${insp.notes ?? 'location not recorded'}.`
        }
      }
      // "what happened with this one" / "tell me about this"
      if (/this (one|inspection)|what happened|tell me about/.test(lower)) {
        return (
          `This is a **${insp.inspectionType}** inspection for **${insp.assetName}** ` +
          `(${insp.assetNum}). Current status: **${insp.status}**. Created ` +
          `${new Date(insp.createdAt).toLocaleDateString()} by ${insp.createdBy}.` +
          (insp.workOrderId ? ` Work order ${insp.workOrderId} was created for it.` : '') +
          (insp.notes ? ` Notes: "${insp.notes}".` : '')
        )
      }
    }
  }

  // ── Aggregate questions ────────────────────────────────────────────────────
  if (/how many|count|total|open|pending/.test(lower)) {
    try {
      const all = await getInspections()
      const open = all.filter(i => ['pending', 'in-progress'].includes(i.status))
      const complete = all.filter(i => ['complete', 'approved'].includes(i.status))
      if (/open|pending|in.progress/.test(lower)) {
        return `You have **${open.length}** open inspection${open.length !== 1 ? 's' : ''} (pending or in-progress) out of ${all.length} total.`
      }
      return `There are **${all.length}** inspections total — ${open.length} open, ${complete.length} completed or approved.`
    } catch {
      return 'I had trouble reading the inspection list — try again in a moment.'
    }
  }

  // ── Screen-specific help ──────────────────────────────────────────────────
  if (/what (can|do) i|how do i|help|guide/.test(lower)) {
    if (ctx.pathname === '/') {
      return `You're on the **New Inspection** screen. Upload or take a photo of an asset, add a description, then tap **Start inspection** — the AI will identify the asset and walk you through a few quick questions.`
    }
    if (ctx.pathname.includes('/analysis')) {
      return `You're on the **AI Review** screen. Check the detected defects on the left, correct any of the pre-filled fields on the right, then tap **Submit to Maximo** to write the record back. The "Why the AI thinks this" section explains the model's reasoning.`
    }
    if (ctx.pathname === '/inspections') {
      return `You're on the **History** screen. You can search by asset name or ID, filter by status or date range, and click any row to open the full inspection record.`
    }
    if (ctx.pathname === '/dashboard') {
      return `The **Dashboard** shows KPI tiles (total inspections, pass rate, avg. confidence, work orders created) plus a weekly trend line and a defect breakdown by asset type. Use the filters to narrow by asset type or date range.`
    }
  }

  // ── Generic fallback ──────────────────────────────────────────────────────
  return (
    `I'm your Maximo Visual Inspections assistant. You're currently on the **${screen}**. ` +
    `I can answer questions about inspections, assets, and what's on screen — or take actions like starting a new inspection or navigating to a page. What would you like to know?`
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateReply(
  text: string,
  ctx: ChatContext,
  _history: GlobalChatMessage[]
): Promise<{ text: string; action?: ChatAction }> {
  // Simulate LLM latency
  await mockDelay(600 + Math.random() * 500)

  // 1. Check for action intent first
  const actionIntent = detectAction(text)
  if (actionIntent) {
    const labels: Record<ChatActionType, string> = {
      start_inspection: 'Opened New Inspection',
      open_dashboard:   'Opened Dashboard',
      open_settings:    'Opened Settings',
      open_inspection:  'Opened inspection record',
      navigate:         'Navigated',
    }
    return {
      text: `Sure — taking you there now.`,
      action: {
        type:  actionIntent.type,
        path:  actionIntent.path,
        label: labels[actionIntent.type],
      },
    }
  }

  // 2. Answer as a question
  const answer = await answerQuestion(text, ctx)
  return { text: answer }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function makeMessageId(): string {
  return `gchat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export { buildContextSummary }
