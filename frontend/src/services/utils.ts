/** Shared utility: simulates async network latency in stub mode */
export function mockDelay(ms = 800): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Generates a simple ID string */
export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
