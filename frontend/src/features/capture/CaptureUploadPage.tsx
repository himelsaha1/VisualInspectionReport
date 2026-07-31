import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, InlineLoading, TextArea } from '@carbon/react'
import {
  Camera,
  ArrowLeft,
  ArrowRight,
  Microphone,
  MicrophoneFilled,
} from '@carbon/icons-react'
import CameraModal from '@/components/CameraModal'
import { createInspection } from '@/services/inspection.service'
import { buildAnalysisRoute, ROUTES } from '@/constants/routes'
import {
  MAX_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
  ACCEPTED_IMAGE_TYPES,
} from '@/constants/inspection.constants'
import type { Asset } from '@/types'
import mockAssets from '@/mock-data/assets.json'
import './CaptureUploadPage.scss'

export default function CaptureUploadPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [description, setDescription] = useState('')
  const [listening, setListening] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [assetSearch, setAssetSearch] = useState('')
  const [showAssetDrop, setShowAssetDrop] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Photo handling ──────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    const valid = arr.filter(f =>
      ACCEPTED_IMAGE_TYPES.includes(f.type) && f.size <= MAX_IMAGE_SIZE_BYTES
    )
    const toAdd = valid.slice(0, MAX_IMAGES - images.length)
    if (toAdd.length < arr.length) setUploadError('Some files skipped — wrong type or over 10 MB.')
    const urls = toAdd.map(f => URL.createObjectURL(f))
    setImages(prev => [...prev, ...toAdd])
    setPreviews(prev => [...prev, ...urls])
  }, [images.length])

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx])
    setImages(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Voice input ─────────────────────────────────────────────────────────────

  const toggleMic = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice input not supported in this browser. Try Chrome or Edge.'); return }
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    setListening(true)
    rec.onresult = (e: { results: { [x: number]: { [x: number]: { transcript: string } } } }) => {
      setDescription(prev => prev + (prev ? ' ' : '') + e.results[0][0].transcript)
      setListening(false)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    rec.start()
  }

  // ── Asset search ────────────────────────────────────────────────────────────

  const filteredAssets = (mockAssets as Asset[]).filter(a =>
    !assetSearch ||
    a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.assetNum.toLowerCase().includes(assetSearch.toLowerCase())
  )

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (images.length === 0) return
    setSubmitting(true)
    setUploadError(null)
    try {
      const inspection = await createInspection({
        assetId: selectedAsset?.id ?? 'unknown',
        assetName: selectedAsset?.name ?? 'Unknown asset',
        assetNum: selectedAsset?.assetNum ?? '—',
        inspectionType: 'visual',
        createdBy: 'j.smith@ibm.com',
        imageFiles: images,
        notes: description,
      })
      navigate(buildAnalysisRoute(inspection.id))
    } catch {
      setUploadError('Failed to submit inspection. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="chat-capture">
      <h2 className="chat-capture__heading">New inspection</h2>
      <p className="chat-capture__sub">
        Take or upload a photo — the AI will analyse it and generate a full inspection report automatically.
      </p>

      {/* Camera modal */}
      {showCamera && (
        <CameraModal
          onCapture={(file, previewUrl) => {
            if (images.length >= MAX_IMAGES) { setUploadError(`Max ${MAX_IMAGES} photos.`); setShowCamera(false); return }
            setImages(prev => [...prev, file])
            setPreviews(prev => [...prev, previewUrl])
            setShowCamera(false)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* ── Photo input ── */}
      <div
        className={`chat-capture__photo-actions${dragOver ? ' chat-capture__photo-actions--dragover' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
      >
        <button
          type="button"
          className="chat-capture__photo-btn chat-capture__photo-btn--camera"
          onClick={() => setShowCamera(true)}
          disabled={images.length >= MAX_IMAGES}
        >
          <Camera size={22} />
          <span>Take photo</span>
        </button>
        <button
          type="button"
          className="chat-capture__photo-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= MAX_IMAGES}
        >
          <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M10 2a1 1 0 0 1 .707.293l4 4a1 1 0 0 1-1.414 1.414L11 5.414V13a1 1 0 1 1-2 0V5.414L6.707 7.707A1 1 0 0 1 5.293 6.293l4-4A1 1 0 0 1 10 2zM3 15a1 1 0 1 1 0 2h14a1 1 0 1 1 0-2H3z" />
          </svg>
          <span>Upload file</span>
        </button>
      </div>
      <p className="chat-capture__dropzone-hint" style={{ marginBlockEnd: '1rem' }}>
        JPG, PNG, WebP · max {MAX_IMAGES} photos · 10 MB each
      </p>

      <input
        ref={fileInputRef}
        type="file"
        className="chat-capture__file-input"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
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

      {/* ── Optional: asset picker ── */}
      <div className="chat-capture__section">
        <label className="chat-capture__section-label">Asset (optional)</label>
        <div style={{ position: 'relative' }}>
          <input
            className="chat-capture__asset-search"
            placeholder={selectedAsset ? selectedAsset.name : 'Search asset name or ID…'}
            value={assetSearch}
            onChange={e => { setAssetSearch(e.target.value); setShowAssetDrop(true) }}
            onFocus={() => setShowAssetDrop(true)}
            onBlur={() => setTimeout(() => setShowAssetDrop(false), 150)}
          />
          {showAssetDrop && filteredAssets.length > 0 && (
            <div className="chat-capture__asset-dropdown">
              {filteredAssets.slice(0, 8).map(a => (
                <div
                  key={a.id}
                  className="chat-capture__asset-option"
                  onMouseDown={() => { setSelectedAsset(a); setAssetSearch(''); setShowAssetDrop(false) }}
                >
                  <strong>{a.name}</strong>
                  <span style={{ color: 'var(--cds-text-secondary)', marginInlineStart: '0.5rem', fontSize: '0.8rem' }}>
                    {a.assetNum} · {a.location}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedAsset && (
          <p style={{ fontSize: '0.75rem', color: 'var(--cds-support-success)', marginBlockStart: '0.25rem' }}>
            ✓ {selectedAsset.name} ({selectedAsset.assetNum}) · {selectedAsset.location}
          </p>
        )}
      </div>

      {/* ── Optional: notes ── */}
      <div className="chat-capture__section">
        <label className="chat-capture__section-label">Notes for the AI (optional)</label>
        <div className="chat-capture__desc-wrapper">
          <TextArea
            id="inspection-description"
            labelText=""
            hideLabel
            placeholder="e.g. 'Noticed this leak three days ago, getting worse' — helps the AI give better recommendations"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
          <button
            type="button"
            className={`chat-capture__mic-btn${listening ? ' chat-capture__mic-btn--listening' : ''}`}
            aria-label={listening ? 'Stop recording' : 'Start voice input'}
            onClick={toggleMic}
          >
            {listening ? <MicrophoneFilled size={18} /> : <Microphone size={18} />}
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="chat-capture__footer">
        <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate(ROUTES.INSPECTIONS)}>
          Cancel
        </Button>
        <Button
          renderIcon={submitting ? undefined : ArrowRight}
          disabled={images.length === 0 || submitting}
          onClick={handleSubmit}
        >
          {submitting
            ? <InlineLoading description="Uploading…" />
            : 'Analyse photo'
          }
        </Button>
      </div>
    </div>
  )
}
