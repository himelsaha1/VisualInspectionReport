import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  DatePicker,
  DatePickerInput,
  Heading,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  SkeletonText,
  TextArea,
  TextInput,
  ToastNotification,
} from '@carbon/react'
import { ArrowLeft, Checkmark } from '@carbon/icons-react'
import { getInspection, updateInspection } from '@/services/inspection.service'
import { createWorkOrder } from '@/services/maximo.service'
import { buildAnalysisRoute } from '@/constants/routes'
import type { Inspection, WorkOrderPriority } from '@/types'
import './WorkOrderPage.scss'

const PRIORITY_OPTIONS: { value: WorkOrderPriority; label: string }[] = [
  { value: '1', label: '1 – Emergency' },
  { value: '2', label: '2 – Urgent' },
  { value: '3', label: '3 – Normal' },
  { value: '4', label: '4 – Low' },
]

function deriveDefaultPriority(inspection: Inspection | null): WorkOrderPriority {
  if (!inspection) return '3'
  // Map inspection status to priority as a sensible default
  if (inspection.status === 'failed') return '1'
  if (inspection.status === 'complete') return '2'
  return '3'
}

export default function WorkOrderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [loadingInspection, setLoadingInspection] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successWoNum, setSuccessWoNum] = useState<string | null>(null)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Form fields
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<WorkOrderPriority>('3')
  const [reportedBy, setReportedBy] = useState('j.smith@ibm.com') // TODO: from auth
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!id) return
    getInspection(id)
      .then(insp => {
        setInspection(insp)
        if (insp) {
          setDescription(`${insp.inspectionType.charAt(0).toUpperCase() + insp.inspectionType.slice(1)} inspection defect found on ${insp.assetName}`)
          setPriority(deriveDefaultPriority(insp))
        }
      })
      .finally(() => setLoadingInspection(false))
  }, [id])

  // Auto-redirect to inspection list after WO creation
  useEffect(() => {
    if (successWoNum) {
      redirectTimer.current = setTimeout(() => {
        navigate('/')
      }, 3000)
    }
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [successWoNum, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inspection || !id) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const result = await createWorkOrder({
        description,
        assetId: inspection.assetId,
        assetNum: inspection.assetNum,
        location: 'PLANT-A', // TODO: fetch from asset detail
        priority,
        dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        reportedBy,
        inspectionId: id,
        notes,
      })

      if (result.status === 'failed') {
        setSubmitError(result.message ?? 'Work order creation failed.')
        return
      }

      // Persist WO number back to inspection record
      await updateInspection(id, {
        status: 'approved',
        workOrderId: result.woNum,
      })
      setSuccessWoNum(result.woNum)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unexpected error creating work order.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingInspection) {
    return (
      <div className="work-order-page">
        <SkeletonText heading paragraph lineCount={6} />
      </div>
    )
  }

  return (
    <div className="work-order-page">
      <Heading style={{ marginBlockEnd: '0.25rem' }}>Create work order</Heading>
      <p style={{ color: 'var(--cds-text-secondary)', marginBlockEnd: '0.5rem' }}>
        {inspection?.assetName} · {inspection?.assetNum}
      </p>

      {successWoNum && (
        <ToastNotification
          kind="success"
          title="Work order created"
          subtitle={`Work order ${successWoNum} has been submitted. Redirecting…`}
          timeout={3000}
          style={{ marginBlockEnd: '1rem' }}
        />
      )}

      {submitError && (
        <InlineNotification
          kind="error"
          title="Submission failed"
          subtitle={submitError}
          onCloseButtonClick={() => setSubmitError(null)}
          style={{ marginBlockEnd: '1rem' }}
        />
      )}

      <form className="work-order-page__form" onSubmit={handleSubmit}>
        {/* Description */}
        <div className="work-order-page__field">
          <TextArea
            id="wo-description"
            labelText="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            required
          />
        </div>

        {/* Priority + Reported by */}
        <div className="work-order-page__row">
          <Select
            id="wo-priority"
            labelText="Priority"
            value={priority}
            onChange={e => setPriority(e.target.value as WorkOrderPriority)}
          >
            {PRIORITY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} text={opt.label} />
            ))}
          </Select>

          <TextInput
            id="wo-reported-by"
            labelText="Reported by"
            value={reportedBy}
            onChange={e => setReportedBy(e.target.value)}
            required
          />
        </div>

        {/* Asset + Location (read-only) */}
        <div className="work-order-page__row">
          <TextInput
            id="wo-asset"
            labelText="Asset"
            value={`${inspection?.assetName ?? ''} (${inspection?.assetNum ?? ''})`}
            readOnly
          />
          <TextInput
            id="wo-location"
            labelText="Location"
            value={inspection ? 'PLANT-A' : ''}
            readOnly
          />
        </div>

        {/* Due date */}
        <div className="work-order-page__field">
          <DatePicker
            datePickerType="single"
            dateFormat="Y-m-d"
            value={dueDate}
            onChange={([date]) => {
              if (date) setDueDate(date.toISOString().split('T')[0])
            }}
          >
            <DatePickerInput
              id="wo-due-date"
              labelText="Due date (optional)"
              placeholder="YYYY-MM-DD"
            />
          </DatePicker>
        </div>

        {/* Notes */}
        <div className="work-order-page__field">
          <TextArea
            id="wo-notes"
            labelText="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Actions */}
        <div className="work-order-page__actions">
          <Button
            kind="ghost"
            renderIcon={ArrowLeft}
            onClick={() => id && navigate(buildAnalysisRoute(id))}
            disabled={submitting || !!successWoNum}
            type="button"
          >
            Back to results
          </Button>

          <Button
            type="submit"
            renderIcon={submitting ? undefined : Checkmark}
            disabled={submitting || !!successWoNum || !description}
          >
            {submitting ? (
              <InlineLoading description="Submitting…" />
            ) : (
              'Submit work order'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
