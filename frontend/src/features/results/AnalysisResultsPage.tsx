import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Heading,
  InlineLoading,
  InlineNotification,
  Tag,
  Tile,
  TextArea,
} from '@carbon/react'
import { ArrowLeft, DocumentAdd, Edit } from '@carbon/icons-react'
import { BoundingBoxCanvas } from '@/components/BoundingBoxCanvas'
import { analyzeImage } from '@/services/mvi.service'
import { getInspection, updateInspection } from '@/services/inspection.service'
import { buildWorkOrderRoute, ROUTES } from '@/constants/routes'
import { CONFIDENCE_THRESHOLD } from '@/constants/inspection.constants'
import type { Inspection, MviInferenceResult, Detection } from '@/types'
import './AnalysisResultsPage.scss'

type CarbonTagType = 'red' | 'purple' | 'blue'
const SEVERITY_TAG: Record<Detection['severity'], CarbonTagType> = {
  high: 'red',
  medium: 'purple',
  low: 'blue',
}

const CONDITION_COLOR: Record<string, string> = {
  Poor: 'var(--cds-support-error)',
  Fair: 'var(--cds-support-warning)',
  Good: 'var(--cds-support-success)',
  Unknown: 'var(--cds-text-secondary)',
}

export default function AnalysisResultsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [result, setResult] = useState<MviInferenceResult | null>(null)
  const [report, setReport] = useState<{ condition: string; summary: string; recommendations: string[] } | null>(null)
  const [statusText, setStatusText] = useState('Loading inspection…')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Editable notes field
  const [techNotes, setTechNotes] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function run() {
      try {
        setStatusText('Loading inspection…')
        const insp = await getInspection(id!)
        if (!insp || cancelled) return
        setInspection(insp)

        setStatusText('Sending photo to Gemini Vision AI…')
        if (cancelled) return

        setStatusText('Analysing defects — this takes a few seconds…')
        const placeholder = new File([], 'placeholder', { type: 'image/jpeg' })
        const mviResult = await analyzeImage(placeholder, id!)
        if (cancelled) return

        setResult(mviResult)

        // Extract full report data from rawResponse
        const raw = mviResult.rawResponse as { condition?: string; summary?: string; recommendations?: string[] } | null
        setReport({
          condition: raw?.condition ?? 'Unknown',
          summary: raw?.summary ?? '',
          recommendations: raw?.recommendations ?? [],
        })

        await updateInspection(id!, { status: 'complete', mviResultId: mviResult.id })
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Analysis failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [id])

  const hasHighSeverity = result?.detections.some(d => d.severity === 'high')
  const hasLowConfidence = result?.detections.some(d => d.confidence < CONFIDENCE_THRESHOLD)

  const imageUrl =
    inspection?.imageUrls?.[0] ??
    'data:image/svg+xml,%3Csvg xmlns%3D"http://www.w3.org/2000/svg" width%3D"400" height%3D"300"%3E%3Crect width%3D"400" height%3D"300" fill%3D"%23262626"/%3E%3Ctext x%3D"200" y%3D"155" fill%3D"%23525252" font-family%3D"sans-serif" font-size%3D"14" text-anchor%3D"middle"%3ENo image%3C/text%3E%3C/svg%3E'

  if (loading) {
    return (
      <div className="results-page">
        <div className="results-page__loading">
          <InlineLoading description={statusText} status="active" />
          <p style={{ fontSize: '0.8rem', color: 'var(--cds-text-secondary)', marginBlockStart: '0.5rem' }}>
            Gemini Vision is analysing your photo for defects…
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="results-page">
        <InlineNotification
          kind="error"
          title="Analysis failed"
          subtitle={error}
          onCloseButtonClick={() => navigate(ROUTES.INSPECTIONS)}
        />
      </div>
    )
  }

  return (
    <div className="results-page">
      {/* ── Header ── */}
      <div className="results-page__header">
        <div>
          <Heading style={{ marginBlockEnd: '0.25rem' }}>Inspection report</Heading>
          <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
            {inspection?.assetName} · {inspection?.assetNum}
          </p>
        </div>
        {report && (
          <div
            className="results-page__condition-badge"
            style={{ borderColor: CONDITION_COLOR[report.condition] ?? 'var(--cds-border-subtle-01)' }}
          >
            <span style={{ color: CONDITION_COLOR[report.condition], fontWeight: 700, fontSize: '1rem' }}>
              {report.condition}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>Overall condition</span>
          </div>
        )}
      </div>

      {/* ── Banners ── */}
      {hasHighSeverity && (
        <InlineNotification
          kind="error"
          title="High-severity defect detected"
          subtitle="One or more findings require immediate attention. Review before approving work order."
          style={{ marginBlockEnd: '1rem' }}
          lowContrast
        />
      )}
      {!hasHighSeverity && hasLowConfidence && (
        <InlineNotification
          kind="warning"
          title="Low confidence detections"
          subtitle={`One or more detections are below ${CONFIDENCE_THRESHOLD}% confidence. Review carefully.`}
          style={{ marginBlockEnd: '1rem' }}
          lowContrast
        />
      )}

      {/* ── AI Summary ── */}
      {report?.summary && (
        <Tile className="results-page__summary-tile">
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBlockEnd: '0.5rem' }}>
            AI Summary
          </p>
          <p style={{ lineHeight: 1.6, fontSize: '0.9375rem' }}>{report.summary}</p>
        </Tile>
      )}

      {/* ── Annotated image + defect list ── */}
      <div className="results-page__grid">
        <Tile className="results-page__canvas-tile">
          <p style={{ marginBlockEnd: '0.75rem', fontWeight: 600 }}>Annotated image</p>
          {result ? (
            <BoundingBoxCanvas imageUrl={imageUrl} detections={result.detections} />
          ) : (
            <p style={{ color: 'var(--cds-text-secondary)' }}>No image available.</p>
          )}
        </Tile>

        <div className="results-page__defect-list">
          <p style={{ fontWeight: 600, marginBlockEnd: '1rem' }}>
            Detected defects ({result?.detections.length ?? 0})
          </p>

          {result?.detections.length === 0 && (
            <p style={{ color: 'var(--cds-text-secondary)' }}>No defects detected — equipment appears to be in good condition.</p>
          )}

          {result?.detections.map((d, i) => (
            <div key={i} className="results-page__defect-item">
              <div className="results-page__defect-header">
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{d.label.replace(/_/g, ' ')}</span>
                <Tag type={SEVERITY_TAG[d.severity]} size="sm">
                  {d.severity.charAt(0).toUpperCase() + d.severity.slice(1)}
                </Tag>
              </div>

              {/* Description from Gemini */}
              {(d as Detection & { description?: string }).description && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--cds-text-secondary)', margin: '0.25rem 0' }}>
                  {(d as Detection & { description?: string }).description}
                </p>
              )}

              <div className="results-page__confidence-bar">
                <div className="results-page__confidence-track">
                  <div
                    className={`results-page__confidence-fill results-page__confidence-fill--${d.severity}`}
                    style={{ width: `${d.confidence}%` }}
                  />
                </div>
                <span style={{ minWidth: '3rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                  {d.confidence.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recommendations ── */}
      {report && report.recommendations.length > 0 && (
        <Tile className="results-page__recommendations-tile">
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBlockEnd: '0.75rem' }}>
            Recommendations
          </p>
          <ol className="results-page__recommendations-list">
            {report.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </Tile>
      )}

      {/* ── Technician notes (optional, editable) ── */}
      <Tile className="results-page__notes-tile">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockEnd: '0.5rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Technician notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
          </p>
          {!editingNotes && (
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cds-link-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
              onClick={() => setEditingNotes(true)}
            >
              <Edit size={14} /> Add notes
            </button>
          )}
        </div>
        {editingNotes ? (
          <TextArea
            id="tech-notes"
            labelText=""
            hideLabel
            placeholder="Add any additional observations, safety concerns, or context for the maintenance team…"
            value={techNotes}
            onChange={e => setTechNotes(e.target.value)}
            rows={3}
          />
        ) : (
          <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
            {techNotes || 'No additional notes. Click "Add notes" to add observations or context.'}
          </p>
        )}
      </Tile>

      {/* ── Actions ── */}
      <div className="results-page__actions">
        <Button kind="secondary" renderIcon={ArrowLeft} onClick={() => navigate(ROUTES.INSPECTION_NEW)}>
          Re-capture
        </Button>
        <Button
          renderIcon={DocumentAdd}
          onClick={() => id && navigate(buildWorkOrderRoute(id))}
          disabled={!id}
        >
          Approve & create work order
        </Button>
      </div>
    </div>
  )
}
