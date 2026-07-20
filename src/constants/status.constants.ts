import type { InspectionStatus, InspectionType } from '@/types'

export const STATUS_LABELS: Record<InspectionStatus, string> = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  complete: 'Complete',
  failed: 'Failed',
  approved: 'Approved',
  rejected: 'Rejected',
}

// Carbon Tag types: 'red' | 'magenta' | 'purple' | 'blue' | 'cyan' | 'teal' | 'green' | 'gray' | ...
export const STATUS_TAG_TYPE: Record<InspectionStatus, string> = {
  pending: 'gray',
  'in-progress': 'blue',
  complete: 'teal',
  failed: 'red',
  approved: 'green',
  rejected: 'magenta',
}

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  visual: 'Visual',
  thermal: 'Thermal',
  structural: 'Structural',
}
