/**
 * maximo.service.ts — Maximo / MAS REST API service
 *
 * STUB MODE: returns mock data with simulated delay.
 *
 * TODO: replace stubs with real Maximo OSLC calls:
 *   Assets:      GET  {VITE_MAXIMO_BASE_URL}/maximo/oslc/os/mxasset
 *   Work Orders: POST {VITE_MAXIMO_BASE_URL}/maximo/oslc/os/mxwo
 *   Headers: { Authorization: `Basic ${btoa('user:pass')}` or MAS IAM Bearer }
 */

import type { Asset, WorkOrderPayload, WorkOrderResult } from '@/types'
import mockAssets from '@/mock-data/assets.json'
import { mockDelay, generateId } from './utils'

export async function getAssets(): Promise<Asset[]> {
  // STUB: return mock asset list
  await mockDelay(600)
  return mockAssets as Asset[]
}

export async function createWorkOrder(
  payload: WorkOrderPayload
): Promise<WorkOrderResult> {
  // STUB: simulate network delay and configurable failure rate
  await mockDelay(1000)

  const failRate = Number(import.meta.env.VITE_MOCK_WO_FAIL_RATE ?? 0)
  if (Math.random() < failRate) {
    return {
      woNum: '',
      status: 'failed',
      message: 'Maximo work order service unavailable (simulated failure).',
    }
  }

  // Generate a realistic-looking WO number
  const woNum = `WO-${10000 + Math.floor(Math.random() * 90000)}`
  console.info('[maximo.service] Work order created (stub):', { woNum, payload })
  return { woNum, status: 'created' }
}

// Suppress unused-var warning on generateId export
export { generateId }
