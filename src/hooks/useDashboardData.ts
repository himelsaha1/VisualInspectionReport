import { useMemo, useState } from 'react'
import type { Inspection, InspectionStatus, AssetType } from '@/types'
import seedData from '@/mock-data/inspections.json'

const ALL_INSPECTIONS = seedData as Inspection[]

const PASSED_STATUSES: InspectionStatus[] = ['complete', 'approved']
const FAILED_STATUSES: InspectionStatus[] = ['failed', 'rejected']
const WO_STATUSES: InspectionStatus[] = ['approved']

// Avg confidence per mvi-result fixture (derived from mock-data/mvi-inference.json)
const AVG_CONFIDENCE_BY_RESULT: Record<string, number> = {
  'mvi-result-001': (87.4 + 72.1 + 63.8) / 3,
  'mvi-result-002': (91.2 + 55.6) / 2,
  'mvi-result-003': (34.5 + 78.9 + 42.3) / 3,
}

// Defect label sets per mvi-result (mirrors mock-data/mvi-inference.json)
const DEFECTS_BY_RESULT: Record<string, string[]> = {
  'mvi-result-001': ['Surface Corrosion', 'Paint Deterioration', 'Minor Scratch'],
  'mvi-result-002': ['Hairline Crack', 'Weld Anomaly'],
  'mvi-result-003': ['Pitting Corrosion', 'Surface Stain', 'Coating Blister'],
}

// Asset type lookup
const ASSET_TYPE_BY_ID: Record<string, AssetType> = {
  'asset-001': 'pump', 'asset-002': 'pump', 'asset-009': 'pump',
  'asset-003': 'pipe', 'asset-010': 'pipe',
  'asset-004': 'tank', 'asset-005': 'tank',
  'asset-006': 'valve',
  'asset-007': 'conveyor',
  'asset-008': 'motor',
}

export interface DashboardFilters {
  assetType: AssetType | 'all'
  startDate: string   // ISO date string or ''
  endDate: string     // ISO date string or ''
}

export function useDashboardData() {
  const [filters, setFilters] = useState<DashboardFilters>({
    assetType: 'all',
    startDate: '',
    endDate: '',
  })

  const filtered = useMemo(() => {
    return ALL_INSPECTIONS.filter(insp => {
      if (filters.assetType !== 'all') {
        if (ASSET_TYPE_BY_ID[insp.assetId] !== filters.assetType) return false
      }
      const d = new Date(insp.createdAt)
      if (filters.startDate && d < new Date(filters.startDate)) return false
      if (filters.endDate && d > new Date(filters.endDate + 'T23:59:59Z')) return false
      return true
    })
  }, [filters])

  // KPIs
  const kpis = useMemo(() => {
    const total = filtered.length
    const passed = filtered.filter(i => PASSED_STATUSES.includes(i.status)).length
    const failed = filtered.filter(i => FAILED_STATUSES.includes(i.status)).length
    const passRate = total > 0 ? Math.round((passed / (passed + failed || 1)) * 100) : 0
    const woCount = filtered.filter(i => WO_STATUSES.includes(i.status)).length

    const confidences = filtered
      .filter(i => i.mviResultId)
      .map(i => AVG_CONFIDENCE_BY_RESULT[i.mviResultId!] ?? 0)
    const avgConfidence =
      confidences.length > 0
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : 0

    return { total, passRate, avgConfidence, woCount }
  }, [filtered])

  // Line chart: inspections per week (grouped)
  const weeklyData = useMemo(() => {
    const buckets: Record<string, { passed: number; failed: number }> = {}

    filtered.forEach(insp => {
      const date = new Date(insp.createdAt)
      // ISO week label: YYYY-Www
      const day = date.getDay()
      const monday = new Date(date)
      monday.setDate(date.getDate() - ((day + 6) % 7))
      const weekLabel = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      if (!buckets[weekLabel]) buckets[weekLabel] = { passed: 0, failed: 0 }
      if (PASSED_STATUSES.includes(insp.status)) buckets[weekLabel].passed++
      else if (FAILED_STATUSES.includes(insp.status)) buckets[weekLabel].failed++
    })

    // Flatten for Carbon Charts LineChart format
    const rows: { group: string; date: string; value: number }[] = []
    Object.entries(buckets)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .forEach(([weekLabel, counts]) => {
        rows.push({ group: 'Passed', date: weekLabel, value: counts.passed })
        rows.push({ group: 'Failed/Rejected', date: weekLabel, value: counts.failed })
      })
    return rows
  }, [filtered])

  // Grouped bar chart: defect types by asset type
  const defectByAssetType = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {}

    filtered.forEach(insp => {
      if (!insp.mviResultId) return
      const assetType = ASSET_TYPE_BY_ID[insp.assetId] ?? 'unknown'
      const defects = DEFECTS_BY_RESULT[insp.mviResultId] ?? []
      defects.forEach(label => {
        if (!counts[label]) counts[label] = {}
        counts[label][assetType] = (counts[label][assetType] ?? 0) + 1
      })
    })

    const rows: { group: string; key: string; value: number }[] = []
    Object.entries(counts).forEach(([label, byType]) => {
      Object.entries(byType).forEach(([assetType, count]) => {
        rows.push({ group: label, key: assetType, value: count })
      })
    })
    return rows
  }, [filtered])

  return { kpis, weeklyData, defectByAssetType, filters, setFilters, allInspections: filtered }
}
