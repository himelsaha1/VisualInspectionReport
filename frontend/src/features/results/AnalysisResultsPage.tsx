import { useEffect, useReducer, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Heading,
  InlineLoading,
  InlineNotification,
  ActionableNotification,
  Tag,
  Tile,
  TextArea,
  Select,
  SelectItem,
  ToastNotification,
  SkeletonText,
  Accordion,
  AccordionItem,
} from '@carbon/react'
import {
  ArrowLeft,
  CheckmarkFilled,
  DocumentAdd,
} from '@carbon/icons-react'
import { BoundingBoxCanvas } from '@/components/BoundingBoxCanvas'
import { analyzeImage } from '@/services/mvi.service'
import { getInspection, updateInspection } from '@/services/inspection.service'
import { buildWorkOrderRoute } from '@/constants/routes'
import { CONFIDENCE_THRESHOLD } from '@/constants/inspection.constants'
import type { Inspection, MviInferenceResult, Detection } from '@/types'
import './AnalysisResultsPage.scss'

// ── Types ────────────────────────────────────────────────────────────────────

type CarbonTagType = 'red' | 'purple' | 'blue' | 'green' | 'gray'

const SEVERITY_TAG: Record<Detection['severity'], CarbonTagType> = {
  high: 'red', medium: 'purple', low: 'blue',
}

const CONFIDENCE_TAG: (c: number) => CarbonTagType = (c) =>
  c >= 85 ? 'green' : c >= 65 ? 'blue' : 'gray'

const CONDITION_CODES = [
  { value: 'CORROSION',    label: 'Corrosion' },
  { value: 'CRACK',        label: 'Crack / Fracture' },
  { value: 'LEAK',         label: 'Leak / Seepage' },
  { value: 'WEAR',         label: 'Wear / Abrasion' },
  { value: 'DEFORMATION',  label: 'Deformation' },
  { value: 'CONTAMINATION',label: 'Contamination' },
  { value: 'OVERHEATING',  label: 'Overheating' },
  { value: 'OTHER',        label: 'Other' },
]

const SEVERITY_OPTIONS = [
  { value: 'high',   label: 'High — immediate action required' },
  { value: 'medium', label: 'Medium — action within 7 days' },
  { value: 'low',    label: 'Low — monitor / next PM' },
]

const ACTION_OPTIONS = [
  { value: 'REPAIR',     label: 'Repair immediately' },
  { value: 'MONITOR',    label: 'Monitor and re-inspect' },
  { value: 'REPLACE',    label: 'Schedule replacement' },
  { value: 'CLEAN',      label: 'Clean and treat' },
  { value: 'NO_ACTION',  label: 'No action required' },
]

// ── Editable review state ────────────────────────────────────────────────────

interface ReviewFields {
  conditionCode: string
  severity: string
  recommendedAction: string
  findings: string
  notes: string
}

type ReviewAction =
  | { type: 'SET'; field: keyof ReviewFields; value: string }
  | { type: 'INIT'; payload: ReviewFields }

function reviewReducer(state: ReviewFields, action: ReviewAction): ReviewFields {
  switch (action.type) {
    case 'SET':   return { ...state, [action.field]: action.value }
    case 'INIT':  return action.payload
    default:      return state
  }
}

function buildInitialReview(detections: Detection[]): ReviewFields {
  const top = detections[0]
  const label = top?.label ?? ''
  // Map detected label to nearest condition code
  const conditionCode =
    label.toLowerCase().includes('corros') ? 'CORROSION' :
    label.toLowerCase().includes('crack')  ? 'CRACK' :
    label.toLowerCase().includes('leak')   ? 'LEAK' :
    label.toLowerCase().includes('wear')   ? 'WEAR' :
    label.toLowerCase().includes('heat')   ? 'OVERHEATING' : 'OTHER'

  return {
    conditionCode,
    severity:          top?.severity ?? 'medium',
    recommendedAction: top?.severity === 'high' ? 'REPAIR' : 'MONITOR',
    findings:          detections.map(d => `${d.label} (${d.confidence.toFixed(0)}%)`).join('; '),
    notes:             '',
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AnalysisResultsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [inspection, setInspection]   = useState<Inspection | null>(null)
  const [result,     setResult]       = useState<MviInferenceResult | null>(null)
  const [statusText, setStatusText]   = useState('Loading inspection…')
  const [error,      setError]        = useState<string | null>(null)
  const [loading,    setLoading]      = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [submitted,  setSubmitted]    = useState(false)
  const [submitError,setSubmitError]  = useState<string | null>(null)

  const [review, dispatch] = useReducer(reviewReducer, {
    conditionCode: 'OTHER', severity: 'medium',
    recommendedAction: 'MONITOR', findings: '', notes: '',
  })

  // Load inspection + run MVI analysis
  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function run() {
      try {
        setStatusText('Loading inspection…')
        const insp = await getInspection(id!)
        if (!insp || cancelled) return
        setInspection(insp)

        setStatusText('Sending image to Maximo Visual Intelligence…')
        await new Promise(r => setTimeout(r, 600))
        if (cancelled) return

        setStatusText('Analysing defects…')
        const imageFile = new File([new Uint8Array(0)], 'inspection.jpg', { type: 'image/jpeg' })
        const mviResult = await analyzeImage(imageFile, id!)
        if (cancelled) return

        setResult(mviResult)
        dispatch({ type: 'INIT', payload: buildInitialReview(mviResult.detections) })
        await updateInspection(id!, { status: 'complete', mviResultId: mviResult.id })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Analysis failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [id])

  // ── Submit to Maximo via MCP ────────────────────────────────────────────────
  // TODO: replace stub with real masdev-manage-mcp tool call:
  //   mcp__mas-manage-mcp__os_mxapiwodetail-createfollowupwotest  OR
  //   navigate to WorkOrderPage which calls mcp__maximo__create_work_order
  const handleSubmit = async () => {
    if (!id || !inspection) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await updateInspection(id, {
        status: 'approved',
        notes: [review.findings, review.notes].filter(Boolean).join(' | '),
      })
      // Small delay to simulate Maximo write
      await new Promise(r => setTimeout(r, 900))
      setSubmitted(true)
      setTimeout(() => navigate('/inspections'), 2500)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit to Maximo. Check your connection and retry.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const hasLowConfidence = result?.detections.some(d => d.confidence < CONFIDENCE_THRESHOLD)
  const imageUrl =
    inspection?.imageUrls?.[0] ??
    'data:image/svg+xml,%3Csvg xmlns%3D"http://www.w3.org/2000/svg" width%3D"400" height%3D"300"%3E%3Crect width%3D"400" height%3D"300" fill%3D"%23262626"/%3E%3Ctext x%3D"200" y%3D"155" fill%3D"%23525252" font-family%3D"sans-serif" font-size%3D"14" text-anchor%3D"middle"%3EInspection image%3C/text%3E%3C/svg%3E'
  const topDetection = result?.detections[0]
  const overallConfidence = result?.detections.length
    ? Math.round(result.detections.reduce((s, d) => s + d.confidence, 0) / result.detections.length)
    : 0

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="results-page">
        <div style={{ marginBlockEnd: '0.5rem' }}><SkeletonText heading width="40%" /></div>
        <div style={{ marginBlockEnd: '1.5rem' }}><SkeletonText width="25%" /></div>
        <div className="results-page__loading">
          <InlineLoading description={statusText} status="active" />
        </div>
        <div className="results-page__grid">
          <Tile className="results-page__canvas-tile results-page__skeleton-tile" />
          <div className="results-page__defect-list">
            <SkeletonText paragraph lineCount={5} />
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="results-page">
        <ActionableNotification
          kind="error"
          title="Analysis failed"
          subtitle={error}
          actionButtonLabel="Retry"
          onActionButtonClick={() => window.location.reload()}
          onClose={() => navigate('/')}
          inline
        />
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className="results-page">
      {/* Success toast */}
      {submitted && (
        <div className="results-page__toast-wrap">
          <ToastNotification
            kind="success"
            title="Inspection submitted"
            subtitle={`Record for ${inspection?.assetNum ?? 'asset'} saved to Maximo. Redirecting…`}
            timeout={2500}
            caption=""
          />
        </div>
      )}

      {/* Page heading */}
      <div className="results-page__header">
        <div>
          <Heading>AI inspection review</Heading>
          <p className="results-page__subhead">
            {inspection?.assetName}
            <span className="results-page__mono"> · {inspection?.assetNum}</span>
            <span className="results-page__mono"> · {inspection?.inspectionType}</span>
          </p>
        </div>
        {/* Overall confidence tag */}
        {result && (
          <Tag type={CONFIDENCE_TAG(overallConfidence)} size="md">
            AI confidence: {overallConfidence}%
          </Tag>
        )}
      </div>

      {/* Low confidence warning */}
      {hasLowConfidence && (
        <InlineNotification
          kind="warning"
          title="Review carefully"
          subtitle={`One or more detections are below ${CONFIDENCE_THRESHOLD}% confidence — the AI may have misclassified something.`}
          style={{ marginBlockEnd: '1rem' }}
          lowContrast
        />
      )}

      {/* Submit error */}
      {submitError && (
        <ActionableNotification
          kind="error"
          title="Couldn't reach Maximo"
          subtitle={submitError}
          actionButtonLabel="Retry"
          onActionButtonClick={handleSubmit}
          onClose={() => setSubmitError(null)}
          style={{ marginBlockEnd: '1rem' }}
          lowContrast
          inline
        />
      )}

      {/* Two-column layout: image left, detections + edit form right */}
      <div className="results-page__grid">

        {/* ── Left: annotated image ── */}
        <Tile className="results-page__canvas-tile">
          <p className="results-page__tile-label">Annotated image</p>
          {result ? (
            <BoundingBoxCanvas imageUrl={imageUrl} detections={result.detections} />
          ) : (
            <p className="results-page__no-image">No image available.</p>
          )}

          {/* Thumbnail strip if multiple images */}
          {(inspection?.imageUrls?.length ?? 0) > 1 && (
            <div className="results-page__thumb-strip">
              {inspection!.imageUrls.map((src, i) => (
                <img key={i} src={src} alt={`Photo ${i + 1}`} className="results-page__thumb" />
              ))}
            </div>
          )}
        </Tile>

        {/* ── Right: detections + editable fields ── */}
        <div className="results-page__right-col">

          {/* Detected defects */}
          <Tile className="results-page__defects-tile">
            <p className="results-page__tile-label">
              Detected defects ({result?.detections.length ?? 0})
            </p>
            {result?.detections.length === 0 && (
              <p className="results-page__secondary">No defects detected.</p>
            )}
            {result?.detections.map((d, i) => (
              <div key={i} className="results-page__defect-item">
                <div className="results-page__defect-header">
                  <span className="results-page__defect-label">{d.label}</span>
                  <div className="results-page__defect-tags">
                    <Tag type={SEVERITY_TAG[d.severity]} size="sm">
                      {d.severity.charAt(0).toUpperCase() + d.severity.slice(1)}
                    </Tag>
                    <Tag type={CONFIDENCE_TAG(d.confidence)} size="sm">
                      {d.confidence.toFixed(0)}%
                    </Tag>
                  </div>
                </div>
                <div className="results-page__confidence-bar">
                  <div className="results-page__confidence-track">
                    <div
                      className={`results-page__confidence-fill results-page__confidence-fill--${d.severity}`}
                      style={{ width: `${d.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </Tile>

          {/* Editable inspection fields */}
          <Tile className="results-page__edit-tile">
            <div className="results-page__edit-header">
              <p className="results-page__tile-label">Inspection fields</p>
              <p className="results-page__secondary">
                AI-populated — correct anything before submitting
              </p>
            </div>

            <div className="results-page__fields">
              <Select
                id="condition-code"
                labelText="Condition code"
                value={review.conditionCode}
                onChange={e => dispatch({ type: 'SET', field: 'conditionCode', value: e.target.value })}
              >
                {CONDITION_CODES.map(o => (
                  <SelectItem key={o.value} value={o.value} text={o.label} />
                ))}
              </Select>

              <Select
                id="severity"
                labelText="Severity"
                value={review.severity}
                onChange={e => dispatch({ type: 'SET', field: 'severity', value: e.target.value })}
              >
                {SEVERITY_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} text={o.label} />
                ))}
              </Select>

              <Select
                id="recommended-action"
                labelText="Recommended action"
                value={review.recommendedAction}
                onChange={e => dispatch({ type: 'SET', field: 'recommendedAction', value: e.target.value })}
              >
                {ACTION_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} text={o.label} />
                ))}
              </Select>

              <TextArea
                id="findings"
                labelText="Findings"
                placeholder="Describe the defect — extent, location, progression…"
                value={review.findings}
                rows={3}
                onChange={e => dispatch({ type: 'SET', field: 'findings', value: e.target.value })}
              />

              <TextArea
                id="notes"
                labelText="Additional notes"
                placeholder="Safety concerns, access restrictions, related issues…"
                value={review.notes}
                rows={2}
                onChange={e => dispatch({ type: 'SET', field: 'notes', value: e.target.value })}
              />
            </div>
          </Tile>

          {/* "Why the AI thinks this" — iceberg pattern, collapsed by default */}
          <Accordion>
            <AccordionItem title="Why the AI thinks this">
              <div className="results-page__why">
                <p className="results-page__secondary">
                  Maximo Visual Intelligence analysed the image using model{' '}
                  <span className="results-page__mono">{result?.modelName ?? 'mvi-defect-v2'}</span>
                  {' '}(v{result?.modelVersion ?? '2.1.0'}).
                </p>
                <ul className="results-page__why-list">
                  {result?.detections.map((d, i) => (
                    <li key={i}>
                      <strong>{d.label}</strong> — detected at{' '}
                      <span className="results-page__mono">{d.confidence.toFixed(1)}%</span> confidence
                      {d.confidence < CONFIDENCE_THRESHOLD && (
                        <Tag type="gray" size="sm" style={{ marginInlineStart: '0.5rem' }}>
                          Low confidence
                        </Tag>
                      )}
                      <br />
                      <span className="results-page__secondary">
                        Bounding box: x={d.bbox[0].toFixed(2)}, y={d.bbox[1].toFixed(2)},
                        w={d.bbox[2].toFixed(2)}, h={d.bbox[3].toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                {topDetection && (
                  <p className="results-page__secondary" style={{ marginBlockStart: '0.75rem' }}>
                    The condition code <strong>{review.conditionCode}</strong> and severity{' '}
                    <strong>{review.severity}</strong> were inferred from the top detection label
                    and confidence score. You can override either field above.
                  </p>
                )}
              </div>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Sticky action footer */}
      <div className="results-page__actions">
        <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate('/')}>
          Back to edit
        </Button>
        <Button kind="danger--ghost" onClick={() => navigate('/')}>
          Discard
        </Button>
        <Button
          renderIcon={submitting ? undefined : CheckmarkFilled}
          disabled={submitting || submitted}
          onClick={handleSubmit}
        >
          {submitting
            ? <InlineLoading description="Submitting…" />
            : 'Submit to Maximo'
          }
        </Button>
        <Button
          kind="secondary"
          renderIcon={DocumentAdd}
          onClick={() => id && navigate(buildWorkOrderRoute(id))}
          disabled={!id || submitting}
        >
          Create work order
        </Button>
      </div>
    </div>
  )
}
