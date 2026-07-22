// Route path constants
export const ROUTES = {
  HOME: '/',
  INSPECTIONS: '/inspections',
  INSPECTION_NEW: '/inspections/new',
  INSPECTION_ANALYSIS: '/inspections/:id/analysis',
  INSPECTION_WORK_ORDER: '/inspections/:id/work-order',
  INSPECTION_RESULTS: '/inspections/:id/results',
  HISTORY: '/history',
  DASHBOARD: '/dashboard',
  SETTINGS: '/settings',
} as const

export function buildAnalysisRoute(id: string) {
  return `/inspections/${id}/analysis`
}

export function buildWorkOrderRoute(id: string) {
  return `/inspections/${id}/work-order`
}

export function buildResultsRoute(id: string) {
  return `/inspections/${id}/results`
}
