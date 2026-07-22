import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Heading,
  InlineLoading,
  InlineNotification,
  Tag,
  Tile,
} from '@carbon/react'
import { ArrowLeft, DocumentAdd } from '@carbon/icons-react'
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

export default function AnalysisResultsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [result, setResult] = useState<MviInferenceResult | null>(null)
  const [statusText, setStatusText] = useState('Loading inspection…')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function run() {
      try {
        setStatusText('Loading inspection…')
        const insp = await getInspection(id!)
        if (!insp || cancelled) return
        setInspection(insp)

        // Use first image or a placeholder for the demo
        const imageFile = new File(
          [new Uint8Array(0)],
          'inspection.jpg',
          { type: 'image/jpeg' }
        )

        setStatusText('Sending image to Maximo Visual Intelligence…')
        await new Promise(r => setTimeout(r, 600))
        if (cancelled) return

        setStatusText('Analysing defects…')
        const mviResult = await analyzeImage(imageFile, id!)
        if (cancelled) return

        setResult(mviResult)
        await updateInspection(id!, {
          status: 'complete',
          mviResultId: mviResult.id,
        })
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

  const hasLowConfidence = result?.detections.some(
    d => d.confidence < CONFIDENCE_THRESHOLD
  )

  // Use the first stored image URL if available, otherwise show a placeholder
  const imageUrl =
    inspection?.imageUrls?.[0] ??
    'data:image/svg+xml,%3Csvg xmlns%3D"http://www.w3.org/2000/svg" width%3D"400" height%3D"300" viewBox%3D"0 0 400 300"%3E%3Crect width%3D"400" height%3D"300" fill%3D"%23262626"/%3E%3Ctext x%3D"200" y%3D"155" fill%3D"%23525252" font-family%3D"sans-serif" font-size%3D"14" text-anchor%3D"middle"%3EInspection image%3C/text%3E%3C/svg%3E'

  if (loading) {
    return (
      <div className="results-page">
        <div className="results-page__loading">
          <InlineLoading description={statusText} status="active" />
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
      <Heading style={{ marginBlockEnd: '0.25rem' }}>Inspection results</Heading>
      <p style={{ color: 'var(--cds-text-secondary)', marginBlockEnd: '0.5rem' }}>
        {inspection?.assetName} · {inspection?.assetNum}
      </p>

      {hasLowConfidence && (
        <InlineNotification
          kind="warning"
          title="Low confidence detections"
          subtitle={`One or more detections have confidence below ${CONFIDENCE_THRESHOLD}%. Review carefully before approving.`}
          style={{ marginBlockEnd: '1rem' }}
          lowContrast
        />
      )}

      <div className="results-page__grid">
        {/* Annotated image */}
        <Tile className="results-page__canvas-tile">
          <p style={{ marginBlockEnd: '0.75rem', fontWeight: 600 }}>Annotated image</p>
          {result ? (
            <BoundingBoxCanvas
              imageUrl={imageUrl}
              detections={result.detections}
            />
          ) : (
            <p>No image available.</p>
          )}
        </Tile>

        {/* Defect list */}
        <div className="results-page__defect-list">
          <p style={{ fontWeight: 600, marginBlockEnd: '1rem' }}>
            Detected defects ({result?.detections.length ?? 0})
          </p>
          {result?.detections.length === 0 && (
            <p style={{ color: 'var(--cds-text-secondary)' }}>No defects detected.</p>
          )}
          {result?.detections.map((d, i) => (
            <div key={i} className="results-page__defect-item">
              <div className="results-page__defect-header">
                <span style={{ fontWeight: 600 }}>{d.label}</span>
                <Tag type={SEVERITY_TAG[d.severity] as CarbonTagType} size="sm">
                  {d.severity.charAt(0).toUpperCase() + d.severity.slice(1)}
                </Tag>
              </div>
              <div className="results-page__confidence-bar">
                <div className="results-page__confidence-track">
                  <div
                    className={`results-page__confidence-fill results-page__confidence-fill--${d.severity}`}
                    style={{ width: `${d.confidence}%` }}
                  />
                </div>
                <span style={{ minWidth: '3rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                  {d.confidence.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="results-page__actions">
        <Button
          kind="secondary"
          renderIcon={ArrowLeft}
          onClick={() => navigate(ROUTES.INSPECTION_NEW)}
        >
          Re-capture
        </Button>
        <Button
          renderIcon={DocumentAdd}
          onClick={() => id && navigate(buildWorkOrderRoute(id))}
          disabled={!id}
        >
          Approve and create work order
        </Button>
      </div>
    </div>
  )
}
