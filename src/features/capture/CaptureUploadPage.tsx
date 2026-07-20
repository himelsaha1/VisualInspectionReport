import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, InlineLoading, ActionableNotification } from '@carbon/react'
import {
  Camera,
  ArrowLeft,
  SendFilled,
  Microphone,
  MicrophoneFilled,
  CheckmarkFilled,
  WarningFilled,
  Edit,
  ArrowRight,
  Image,
} from '@carbon/icons-react'
import {
  resolveAsset,
  generateFirstMessage,
  getClarifyingQuestions,
  parsePriorityFromText,
} from '@/services/ai.service'
import type { AssetResolution, ChatMessage, ReviewRecord } from '@/services/ai.service'
import { createInspection } from '@/services/inspection.service'
import { buildAnalysisRoute, ROUTES } from '@/constants/routes'
import {
  MAX_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
  ACCEPTED_IMAGE_TYPES,
} from '@/constants/inspection.constants'
import type { Asset, InspectionType } from '@/types'
import mockAssets from '@/mock-data/assets.json'
import './CaptureUploadPage.scss'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'capture' | 'resolving' | 'chat' | 'review'

type InspectionTypeOption = { id: InspectionType; label: string }
const INSPECTION_TYPES: InspectionTypeOption[] = [
  { id: 'visual', label: 'Visual' },
  { id: 'thermal', label: 'Thermal' },
  { id: 'structural', label: 'Structural' },
]

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function msgId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ─── Draft persistence ────────────────────────────────────────────────────────

const DRAFT_KEY = 'maximo_inspection_draft'

interface DraftState {
  phase: Phase
  messages: ChatMessage[]
  resolution: AssetResolution | null
  description: string
  questionIndex: number
  review: ReviewRecord | null
  inspectionType: InspectionType
  previewDataUrls: string[]
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function saveDraft(draft: DraftState) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // quota exceeded — silently ignore
  }
}

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as DraftState) : null
  } catch {
    return null
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CaptureUploadPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Photo state
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  // Parallel array of base64 data-URLs for draft persistence (File objects can't be serialised)
  const [previewDataUrls, setPreviewDataUrls] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Description
  const [description, setDescription] = useState('')
  const [listening, setListening] = useState(false)

  // ── Phase
  const [phase, setPhase] = useState<Phase>('capture')

  // ── Asset resolution
  const [resolution, setResolution] = useState<AssetResolution | null>(null)
  const [manualSearch, setManualSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [inspectionType, setInspectionType] = useState<InspectionType>('visual')
  const [showTypeMenu, setShowTypeMenu] = useState(false)

  // ── Chat
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [aiTyping, setAiTyping] = useState(false)
  const [reply, setReply] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const questions = getClarifyingQuestions()

  // ── Review
  const [review, setReview] = useState<ReviewRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Draft resume
  const [showResumeBanner, setShowResumeBanner] = useState(false)
  const pendingDraftRef = useRef<DraftState | null>(null)

  // ── Scroll to bottom of thread
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiTyping])

  // ── Restore draft on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const draft = loadDraft()
    if (draft && draft.phase !== 'capture') {
      // Only prompt resume if user was past the initial capture step
      pendingDraftRef.current = draft
      setShowResumeBanner(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyDraft = (draft: DraftState) => {
    setPhase(draft.phase)
    setMessages(draft.messages)
    setResolution(draft.resolution)
    setDescription(draft.description)
    setQuestionIndex(draft.questionIndex)
    setReview(draft.review)
    setInspectionType(draft.inspectionType)
    // Restore previews from stored data-URLs (no File objects — display-only)
    setPreviews(draft.previewDataUrls)
    setPreviewDataUrls(draft.previewDataUrls)
    setShowResumeBanner(false)
    pendingDraftRef.current = null
  }

  const handleResumeDraft = () => {
    if (pendingDraftRef.current) applyDraft(pendingDraftRef.current)
  }

  const handleDiscardDraft = () => {
    clearDraft()
    setShowResumeBanner(false)
    pendingDraftRef.current = null
  }

  // ── Save draft on state change (debounced 500 ms) ──────────────────────────
  useEffect(() => {
    // Don't persist the initial blank state or after submission
    if (phase === 'capture' && messages.length === 0 && !description && previews.length === 0) return

    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current)
    draftSaveTimerRef.current = setTimeout(() => {
      saveDraft({ phase, messages, resolution, description, questionIndex, review, inspectionType, previewDataUrls })
    }, 500)

    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, messages, resolution, description, questionIndex, review, inspectionType, previewDataUrls])

  // ─── Photo handling ────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    const valid = arr.filter(f => {
      if (!ACCEPTED_IMAGE_TYPES.includes(f.type)) return false
      if (f.size > MAX_IMAGE_SIZE_BYTES) return false
      return true
    })
    const toAdd = valid.slice(0, MAX_IMAGES - images.length)
    if (toAdd.length < arr.length) {
      setUploadError('Some files were skipped (wrong type or over 10 MB).')
    }
    const urls = toAdd.map(f => URL.createObjectURL(f))
    setImages(prev => [...prev, ...toAdd])
    setPreviews(prev => [...prev, ...urls])
    // Convert to data-URLs asynchronously for draft persistence
    Promise.all(toAdd.map(fileToDataUrl)).then(dataUrls => {
      setPreviewDataUrls(prev => [...prev, ...dataUrls])
    })
  }, [images.length])

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx])
    setImages(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
    setPreviewDataUrls(prev => prev.filter((_, i) => i !== idx))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  // ─── Voice input ──────────────────────────────────────────────────────────

  const toggleMic = (target: 'desc' | 'reply') => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'en-US'
    rec.interimResults = false
    setListening(true)
    rec.onresult = (e: { results: { [x: number]: { [x: number]: { transcript: string } } } }) => {
      const text = e.results[0][0].transcript
      if (target === 'desc') setDescription(prev => prev + (prev ? ' ' : '') + text)
      else setReply(prev => prev + (prev ? ' ' : '') + text)
      setListening(false)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    rec.start()
  }

  // ─── Start inspection → asset resolution → chat ───────────────────────────

  const handleStart = async () => {
    if (images.length === 0) return
    setPhase('resolving')

    try {
      const res = await resolveAsset(description)
      setResolution(res)
      setInspectionType(res.inferredInspectionType)

      // Begin chat phase
      setPhase('chat')
      setAiTyping(true)

      const firstMsg = await generateFirstMessage(res, description)
      const aiMsg: ChatMessage = {
        id: msgId(), role: 'ai', text: firstMsg, timestamp: nowLabel(),
      }
      setMessages([aiMsg])
      setAiTyping(false)

      // Ask first clarifying question
      await askNextQuestion(0, [aiMsg])
    } catch {
      setPhase('capture')
      setUploadError('Trouble analysing the photo. Try again or search for the asset manually.')
    }
  }

  const pushAiMessage = async (
    text: string,
    extra?: Partial<ChatMessage>,
    currentMsgs?: ChatMessage[]
  ): Promise<ChatMessage[]> => {
    const msg: ChatMessage = { id: msgId(), role: 'ai', text, timestamp: nowLabel(), ...extra }
    const next = [...(currentMsgs ?? messages), msg]
    setMessages(next)
    return next
  }

  const askNextQuestion = async (idx: number, currentMsgs: ChatMessage[]) => {
    if (idx >= questions.length) {
      setAiTyping(true)
      await new Promise(r => setTimeout(r, 600))
      await pushAiMessage('Ready to review. Take a look and confirm everything looks right.', {}, currentMsgs)
      setAiTyping(false)
      return
    }
    const q = questions[idx]
    setAiTyping(true)
    await new Promise(r => setTimeout(r, 700))
    const next = await pushAiMessage(q.question, {
      skippable: q.skippable, fieldKey: q.fieldKey,
    }, currentMsgs)
    setAiTyping(false)
    setQuestionIndex(idx)
    setMessages(next)
  }

  // ─── Tech reply ───────────────────────────────────────────────────────────

  const handleReply = async (text: string, skipped = false) => {
    if (!text.trim() && !skipped) return
    const displayText = skipped ? '(skipped)' : text
    const techMsg: ChatMessage = {
      id: msgId(), role: 'tech', text: displayText, timestamp: nowLabel(),
    }
    const withTech = [...messages, techMsg]
    setMessages(withTech)
    setReply('')

    // Parse reply into review record
    setReview(prev => {
      const q = questions[questionIndex]
      const base: ReviewRecord = prev ?? {
        assetId: resolution?.asset?.id ?? '',
        assetName: resolution?.asset?.name ?? '',
        assetNum: resolution?.asset?.assetNum ?? '',
        location: resolution?.asset?.location ?? '',
        inspectionType,
        findings: description,
        priority: '3',
        notes: '',
        flaggedFields: [],
      }
      if (!q || skipped) {
        return { ...base, flaggedFields: q ? [...base.flaggedFields, q.fieldKey] : base.flaggedFields }
      }
      if (q.fieldKey === 'priority') return { ...base, priority: parsePriorityFromText(text) }
      if (q.fieldKey === 'findings') return { ...base, findings: text || base.findings }
      if (q.fieldKey === 'notes') return { ...base, notes: text }
      return base
    })

    const nextIdx = questionIndex + 1
    await askNextQuestion(nextIdx, withTech)
  }

  // ─── Proceed to review ────────────────────────────────────────────────────

  const handleGoToReview = () => {
    // Ensure review record is populated
    setReview(prev => prev ?? {
      assetId: resolution?.asset?.id ?? '',
      assetName: resolution?.asset?.name ?? '',
      assetNum: resolution?.asset?.assetNum ?? '',
      location: resolution?.asset?.location ?? '',
      inspectionType,
      findings: description,
      priority: '3',
      notes: '',
      flaggedFields: [],
    })
    setPhase('review')
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!review) return
    setSubmitting(true)
    try {
      const inspection = await createInspection({
        assetId: review.assetId || 'unknown',
        assetName: review.assetName || 'Unknown asset',
        assetNum: review.assetNum || '—',
        inspectionType: review.inspectionType,
        createdBy: 'j.smith@ibm.com',
        imageUrls: previews,
        notes: [review.findings, review.notes].filter(Boolean).join(' | '),
      })
      clearDraft()
      navigate(buildAnalysisRoute(inspection.id))
    } catch {
      setUploadError('Failed to submit inspection. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Asset manual override ─────────────────────────────────────────────────

  const filteredAssets = (mockAssets as Asset[]).filter(a =>
    !manualSearch || a.name.toLowerCase().includes(manualSearch.toLowerCase()) ||
    a.assetNum.toLowerCase().includes(manualSearch.toLowerCase())
  )

  const selectAsset = (asset: Asset) => {
    setResolution(prev => prev
      ? { ...prev, asset, confidence: 'high' }
      : { asset, confidence: 'high', candidates: [], inferredInspectionType: inspectionType }
    )
    setManualSearch('')
    setShowDropdown(false)
    // Update review if it exists
    setReview(prev => prev ? { ...prev, assetId: asset.id, assetName: asset.name, assetNum: asset.assetNum, location: asset.location } : prev)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const isReadyToStart = images.length > 0 && phase === 'capture'
  const isReadyToReview = phase === 'chat' && messages.some(m => m.text.includes('Ready to review'))

  return (
    <div className="chat-capture">

      {/* ── Draft resume banner ── */}
      {showResumeBanner && (
        <ActionableNotification
          kind="info"
          title="Resume inspection?"
          subtitle="You have an inspection in progress. Resume where you left off, or start fresh."
          actionButtonLabel="Resume"
          onActionButtonClick={handleResumeDraft}
          onClose={handleDiscardDraft}
          style={{ marginBlockEnd: '1rem' }}
          lowContrast
          inline
        />
      )}

      <h2 className="chat-capture__heading">Start inspection</h2>
      <p className="chat-capture__sub">
        {phase === 'capture' && 'Add a photo and describe what you see — the AI will handle the rest.'}
        {phase === 'resolving' && 'Analysing your photo…'}
        {phase === 'chat' && 'Answer a few quick questions to complete the record.'}
        {phase === 'review' && 'Review and confirm before submitting.'}
      </p>

      {/* ── STEP 1: Photo zone + description ── */}
      {phase !== 'review' && (
        <>
          {/* Drop zone — click opens file picker */}
          <div
            className={`chat-capture__dropzone${dragOver ? ' chat-capture__dropzone--active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Add inspection photos from library"
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <div className="chat-capture__dropzone-icon">
              <Image size={40} />
            </div>
            <p className="chat-capture__dropzone-label">
              {images.length === 0
                ? 'Tap to upload from library, or drag and drop here'
                : `${images.length} photo${images.length > 1 ? 's' : ''} added — tap to add more`}
            </p>
            <p className="chat-capture__dropzone-hint">JPG, PNG, WebP · max {MAX_IMAGES} images · 10 MB each</p>
          </div>

          {/* Camera capture button */}
          <button
            type="button"
            className="chat-capture__camera-btn"
            onClick={() => cameraInputRef.current?.click()}
            aria-label="Take photo with device camera"
          >
            <Camera size={18} />
            Take photo
          </button>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            className="chat-capture__file-input"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
          />
          {/* capture="environment" opens rear camera on mobile */}
          <input
            ref={cameraInputRef}
            type="file"
            className="chat-capture__file-input"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            capture="environment"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
          />

          {/* Thumbnail strip */}
          {previews.length > 0 && (
            <div className="chat-capture__thumbs">
              {previews.map((src, idx) => (
                <div key={src} className="chat-capture__thumb">
                  <img src={src} alt={`Photo ${idx + 1}`} />
                  <button
                    type="button"
                    className="chat-capture__thumb-remove"
                    aria-label={`Remove photo ${idx + 1}`}
                    onClick={e => { e.stopPropagation(); removeImage(idx) }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <p style={{ color: 'var(--cds-support-error)', fontSize: '0.8rem', marginBlockEnd: '0.75rem' }}>
              {uploadError}
            </p>
          )}

          {/* Description + mic */}
          {phase === 'capture' && (
            <div className="chat-capture__desc-wrapper">
              <textarea
                className="chat-capture__desc"
                placeholder="What are you looking at? Describe what you see…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
              <button
                type="button"
                className={`chat-capture__mic-btn${listening ? ' chat-capture__mic-btn--listening' : ''}`}
                aria-label={listening ? 'Stop recording' : 'Start voice input'}
                onClick={() => toggleMic('desc')}
              >
                {listening ? <MicrophoneFilled size={18} /> : <Microphone size={18} />}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── STEP 2: Asset resolution banner ── */}
      {(phase === 'resolving' || phase === 'chat') && (
        <div className={`chat-capture__asset-banner chat-capture__asset-banner--${
          phase === 'resolving' ? 'resolving' :
          resolution?.confidence === 'high' ? 'resolved' : 'low'
        }`}>
          {phase === 'resolving' ? (
            <InlineLoading description="Identifying asset…" status="active" />
          ) : (
            <>
              <div className="chat-capture__asset-banner-inner">
                {resolution?.asset ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="chat-capture__asset-chip">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {resolution.confidence === 'high'
                          ? <CheckmarkFilled size={14} style={{ color: 'var(--cds-support-success)', flexShrink: 0 }} />
                          : <WarningFilled size={14} style={{ color: 'var(--cds-support-warning)', flexShrink: 0 }} />
                        }
                        <span className="chat-capture__asset-name">{resolution.asset.name}</span>
                      </div>
                      <span className="chat-capture__asset-meta">
                        {resolution.asset.assetNum} · {resolution.asset.location}
                        {resolution.confidence === 'low' && ' · Low confidence'}
                      </span>
                    </div>

                    <div className="chat-capture__asset-actions">
                      {/* Inspection type chip */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          className="chat-capture__type-chip"
                          onClick={() => setShowTypeMenu(v => !v)}
                          title="Change inspection type"
                        >
                          {INSPECTION_TYPES.find(t => t.id === inspectionType)?.label ?? inspectionType}
                          <Edit size={12} />
                        </button>
                        {showTypeMenu && (
                          <div className="chat-capture__asset-dropdown" style={{ top: '2rem', left: 0, minWidth: '9rem' }}>
                            {INSPECTION_TYPES.map(t => (
                              <div
                                key={t.id}
                                className="chat-capture__asset-option"
                                onClick={() => { setInspectionType(t.id); setShowTypeMenu(false) }}
                              >
                                {t.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* "Not this asset?" override */}
                      <button
                        type="button"
                        onClick={() => setShowDropdown(v => !v)}
                        style={{
                          background: 'none', border: 'none', fontSize: '0.75rem',
                          color: 'var(--cds-link-primary)', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        Not this asset?
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                    <WarningFilled size={14} style={{ color: 'var(--cds-support-warning)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                      Couldn't identify the asset — search below
                    </span>
                  </div>
                )}

                {/* Inline asset search */}
                {(showDropdown || !resolution?.asset) && (
                  <div style={{ marginBlockStart: '0.625rem' }}>
                    <input
                      className="chat-capture__asset-search"
                      placeholder="Search asset name or ID…"
                      value={manualSearch}
                      onChange={e => { setManualSearch(e.target.value); setShowDropdown(true) }}
                      autoFocus
                    />
                    {showDropdown && filteredAssets.length > 0 && (
                      <div className="chat-capture__asset-dropdown">
                        {filteredAssets.slice(0, 8).map(a => (
                          <div key={a.id} className="chat-capture__asset-option" onClick={() => selectAsset(a)}>
                            <strong>{a.name}</strong>
                            <span style={{ color: 'var(--cds-text-secondary)', marginInlineStart: '0.5rem', fontSize: '0.8rem' }}>
                              {a.assetNum} · {a.location}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 3: Chat thread ── */}
      {phase === 'chat' && (
        <>
          <div className="chat-capture__thread">
            {messages.map((msg, idx) => (
              <div key={msg.id}>
                <div className={`chat-capture__bubble chat-capture__bubble--${msg.role}`}>
                  {msg.text}
                </div>
                <div className={`chat-capture__bubble-meta chat-capture__bubble-meta--${msg.role}`}>
                  {msg.role === 'ai' ? 'MVI Assistant' : 'You'} · {msg.timestamp}
                </div>
                {/* Skip affordance on AI questions */}
                {msg.role === 'ai' && msg.skippable && idx === messages.length - 1 && !aiTyping && (
                  <button
                    type="button"
                    className="chat-capture__skip-btn"
                    onClick={() => handleReply('', true)}
                  >
                    Not sure / Skip
                  </button>
                )}
              </div>
            ))}

            {aiTyping && (
              <div className="chat-capture__typing">
                <span /><span /><span />
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Reply row */}
          {!aiTyping && !isReadyToReview && (
            <div className="chat-capture__reply-row">
              <textarea
                ref={replyRef}
                className="chat-capture__reply-input"
                placeholder="Reply…"
                value={reply}
                rows={1}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleReply(reply)
                  }
                }}
              />
              <button
                type="button"
                className={`chat-capture__mic-btn${listening ? ' chat-capture__mic-btn--listening' : ''}`}
                aria-label="Voice reply"
                onClick={() => toggleMic('reply')}
              >
                {listening ? <MicrophoneFilled size={18} /> : <Microphone size={18} />}
              </button>
              <Button
                size="md"
                renderIcon={SendFilled}
                iconDescription="Send"
                hasIconOnly
                onClick={() => handleReply(reply)}
                disabled={!reply.trim()}
              />
            </div>
          )}
        </>
      )}

      {/* ── STEP 4: Review card ── */}
      {phase === 'review' && review && (
        <div className="chat-capture__review">
          <div className="chat-capture__review-header">
            <CheckmarkFilled size={16} style={{ color: 'var(--cds-support-success)' }} />
            Review &amp; confirm
          </div>
          <div className="chat-capture__review-body">
            {/* Photos */}
            <div className="chat-capture__review-row">
              <span className="chat-capture__review-label">Photos</span>
              <div className="chat-capture__review-thumbs">
                {previews.map((src, i) => (
                  <img key={i} src={src} alt={`Photo ${i + 1}`} className="chat-capture__review-thumb" />
                ))}
              </div>
            </div>

            {/* Asset */}
            <div className="chat-capture__review-row">
              <span className="chat-capture__review-label">Asset</span>
              <span className={`chat-capture__review-value${!review.assetName ? ' chat-capture__review-value--flagged' : ''}`}>
                {review.assetName || 'Not specified'}
                {!review.assetName && <WarningFilled size={12} style={{ marginInlineStart: '0.35rem', color: 'var(--cds-support-warning)' }} />}
              </span>
            </div>

            {/* Type */}
            <div className="chat-capture__review-row">
              <span className="chat-capture__review-label">Inspection type</span>
              <span className="chat-capture__review-value">
                {INSPECTION_TYPES.find(t => t.id === review.inspectionType)?.label}
              </span>
            </div>

            {/* Findings */}
            <div className="chat-capture__review-row">
              <span className="chat-capture__review-label">Findings</span>
              <span
                className={`chat-capture__review-value chat-capture__review-value--editable${
                  review.flaggedFields.includes('findings') ? ' chat-capture__review-value--flagged' : ''
                }`}
                contentEditable
                suppressContentEditableWarning
                onBlur={e => setReview(r => r ? { ...r, findings: e.currentTarget.textContent ?? '' } : r)}
              >
                {review.findings || 'Not specified'}
              </span>
            </div>

            {/* Priority */}
            <div className="chat-capture__review-row">
              <span className="chat-capture__review-label">Priority</span>
              <span
                className={`chat-capture__review-value chat-capture__review-value--editable${
                  review.flaggedFields.includes('priority') ? ' chat-capture__review-value--flagged' : ''
                }`}
                contentEditable
                suppressContentEditableWarning
                onBlur={e => setReview(r => r ? { ...r, priority: e.currentTarget.textContent ?? '3' } : r)}
              >
                {review.priority === '1' ? '1 – Emergency'
                  : review.priority === '2' ? '2 – Urgent'
                  : review.priority === '4' ? '4 – Low'
                  : '3 – Normal'}
              </span>
            </div>

            {/* Notes */}
            <div className="chat-capture__review-row">
              <span className="chat-capture__review-label">Notes</span>
              <span
                className={`chat-capture__review-value chat-capture__review-value--editable${
                  review.flaggedFields.includes('notes') ? ' chat-capture__review-value--flagged' : ''
                }`}
                contentEditable
                suppressContentEditableWarning
                onBlur={e => setReview(r => r ? { ...r, notes: e.currentTarget.textContent ?? '' } : r)}
              >
                {review.notes || 'None'}
              </span>
            </div>

            {review.flaggedFields.length > 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--cds-support-warning)', marginBlockStart: '0.25rem' }}>
                <WarningFilled size={12} style={{ verticalAlign: 'middle', marginInlineEnd: '0.3rem' }} />
                Highlighted fields were skipped — tap to edit before submitting.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Sticky footer ── */}
      <div className="chat-capture__footer">
        <Button
          kind="ghost"
          renderIcon={ArrowLeft}
          onClick={() => {
            if (phase === 'review') { setPhase('chat'); return }
            clearDraft()
            navigate(ROUTES.INSPECTIONS)
          }}
          disabled={submitting || phase === 'resolving'}
        >
          {phase === 'review' ? 'Back to conversation' : 'Cancel'}
        </Button>

        {phase === 'capture' && (
          <Button renderIcon={ArrowRight} disabled={!isReadyToStart} onClick={handleStart}>
            Start inspection
          </Button>
        )}

        {phase === 'chat' && isReadyToReview && (
          <Button renderIcon={ArrowRight} onClick={handleGoToReview}>
            Review inspection
          </Button>
        )}

        {phase === 'review' && (
          <Button
            renderIcon={submitting ? undefined : CheckmarkFilled}
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting
              ? <InlineLoading description="Submitting…" />
              : 'Submit inspection'
            }
          </Button>
        )}
      </div>
    </div>
  )
}
