import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InlineLoading, Tag } from '@carbon/react'
import {
  Close,
  Search,
  ChevronRight,
  Time,
  ListBulleted,
  Dashboard,
} from '@carbon/icons-react'
import { useInspections } from '@/hooks/useInspections'
import {
  STATUS_LABELS,
  STATUS_TAG_TYPE,
  INSPECTION_TYPE_LABELS,
} from '@/constants/status.constants'
import type { InspectionStatus } from '@/types'
import { buildAnalysisRoute, ROUTES } from '@/constants/routes'
import './HistoryDrawer.scss'

interface HistoryDrawerProps {
  open: boolean
  onClose: () => void
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function HistoryDrawer({ open, onClose }: HistoryDrawerProps) {
  const navigate = useNavigate()
  const { inspections, loading } = useInspections()
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Focus search when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return inspections
      .filter(i =>
        !q ||
        i.assetName.toLowerCase().includes(q) ||
        i.assetNum.toLowerCase().includes(q) ||
        i.inspectionType.toLowerCase().includes(q)
      )
      .slice(0, 60)
  }, [inspections, search])

  const handleItemClick = (id: string) => {
    onClose()
    navigate(buildAnalysisRoute(id))
  }

  const handleNavClick = (path: string) => {
    onClose()
    navigate(path)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`history-drawer__backdrop${open ? ' history-drawer__backdrop--visible' : ''}`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`history-drawer${open ? ' history-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Inspection history"
      >
        {/* Header */}
        <div className="history-drawer__header">
          <div className="history-drawer__title">
            <Time size={16} />
            History &amp; navigation
          </div>
          <button
            type="button"
            className="history-drawer__close"
            aria-label="Close history panel"
            onClick={onClose}
          >
            <Close size={20} />
          </button>
        </div>

        {/* Nav links — Past Inspections + Dashboard */}
        <nav className="history-drawer__nav" aria-label="Secondary navigation">
          <button
            type="button"
            className="history-drawer__nav-item"
            onClick={() => handleNavClick(ROUTES.INSPECTIONS)}
          >
            <ListBulleted size={16} />
            <span>Past inspections</span>
            <ChevronRight size={14} className="history-drawer__item-chevron" />
          </button>
          <button
            type="button"
            className="history-drawer__nav-item"
            onClick={() => handleNavClick(ROUTES.DASHBOARD)}
          >
            <Dashboard size={16} />
            <span>Reporting dashboard</span>
            <ChevronRight size={14} className="history-drawer__item-chevron" />
          </button>
        </nav>

        <div className="history-drawer__section-label">Recent inspections</div>

        {/* Search */}
        <div className="history-drawer__search-wrap">
          <Search size={16} className="history-drawer__search-icon" />
          <input
            ref={inputRef}
            type="search"
            className="history-drawer__search"
            placeholder="Search by asset, ID, or type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search inspections"
          />
        </div>

        {/* Count row */}
        <div className="history-drawer__meta">
          {loading
            ? <InlineLoading description="Loading…" status="active" />
            : <span>{filtered.length} inspection{filtered.length !== 1 ? 's' : ''}</span>
          }
        </div>

        {/* List */}
        <div className="history-drawer__list" role="list">
          {!loading && filtered.length === 0 && (
            <div className="history-drawer__empty">
              No inspections match your search.
            </div>
          )}
          {filtered.map(insp => (
            <button
              key={insp.id}
              type="button"
              className="history-drawer__item"
              role="listitem"
              onClick={() => handleItemClick(insp.id)}
            >
              <div className="history-drawer__item-main">
                <span className="history-drawer__item-asset">{insp.assetName}</span>
                <span className="history-drawer__item-meta">
                  {insp.assetNum} · {INSPECTION_TYPE_LABELS[insp.inspectionType]}
                </span>
              </div>
              <div className="history-drawer__item-right">
                <Tag
                  type={STATUS_TAG_TYPE[insp.status] as 'gray' | 'blue' | 'teal' | 'red' | 'green' | 'magenta'}
                  size="sm"
                >
                  {STATUS_LABELS[insp.status as InspectionStatus]}
                </Tag>
                <span className="history-drawer__item-date">{relativeDate(insp.createdAt)}</span>
                <ChevronRight size={14} className="history-drawer__item-chevron" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
