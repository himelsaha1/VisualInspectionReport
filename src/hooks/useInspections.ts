import { useEffect, useState } from 'react'
import type { Inspection } from '@/types'
import { getInspections } from '@/services/inspection.service'

interface UseInspectionsResult {
  inspections: Inspection[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useInspections(): UseInspectionsResult {
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getInspections()
      .then(data => {
        if (!cancelled) setInspections(data)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load inspections')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  return { inspections, loading, error, refresh: () => setTick(t => t + 1) }
}
