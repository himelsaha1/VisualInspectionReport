import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

interface Crumb {
  label: string
  href?: string
}

const SEGMENT_LABELS: Record<string, string> = {
  inspections: 'Inspections',
  new: 'New inspection',
  analysis: 'Analysis results',
  'work-order': 'Work order',
  results: 'Results',
  history: 'History',
  dashboard: 'Dashboard',
}

export function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation()

  return useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    const crumbs: Crumb[] = [{ label: 'Home', href: '/' }]

    segments.forEach((seg, idx) => {
      const isLast = idx === segments.length - 1
      const href = '/' + segments.slice(0, idx + 1).join('/')
      // Skip UUID-like segments (inspection IDs) from the label
      const isId = /^[a-zA-Z0-9]+-[a-zA-Z0-9]+-/.test(seg)
      const label = isId ? null : (SEGMENT_LABELS[seg] ?? seg)
      if (label) {
        crumbs.push({ label, href: isLast ? undefined : href })
      }
    })

    return crumbs
  }, [pathname])
}
