import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@carbon/react'
import { Renew, Close, CheckmarkFilled } from '@carbon/icons-react'
import './CameraModal.scss'

interface CameraModalProps {
  onCapture: (file: File, previewUrl: string) => void
  onClose: () => void
}

export default function CameraModal({ onCapture, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setSnapshot(null)
    setError(null)
    setStarting(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('Camera permission denied. Please allow camera access in your browser settings.')
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setError('No camera found on this device.')
      } else {
        setError(`Could not start camera: ${msg}`)
      }
    } finally {
      setStarting(false)
    }
  }, [])

  // Start camera on mount
  useEffect(() => {
    startCamera(facingMode)
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFlip = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    startCamera(next)
  }

  const handleShutter = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setSnapshot(dataUrl)

    // Pause the live feed while previewing
    video.pause()
  }

  const handleRetake = () => {
    setSnapshot(null)
    videoRef.current?.play()
  }

  const handleConfirm = () => {
    if (!snapshot || !canvasRef.current) return
    canvasRef.current.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onCapture(file, snapshot)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Camera capture">
      <div className="camera-modal__backdrop" onClick={onClose} />

      <div className="camera-modal__panel">
        {/* Header */}
        <div className="camera-modal__header">
          <span className="camera-modal__title">Take a photo</span>
          <button className="camera-modal__close" aria-label="Close camera" onClick={onClose}>
            <Close size={20} />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="camera-modal__viewfinder">
          {error ? (
            <div className="camera-modal__error">
              <p>{error}</p>
              <Button kind="ghost" size="sm" onClick={() => startCamera(facingMode)}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              {starting && (
                <div className="camera-modal__starting">Starting camera…</div>
              )}
              {/* Live video — hidden when snapshot taken */}
              <video
                ref={videoRef}
                className={`camera-modal__video${snapshot ? ' camera-modal__video--hidden' : ''}`}
                playsInline
                muted
              />
              {/* Snapshot preview */}
              {snapshot && (
                <img
                  src={snapshot}
                  alt="Snapshot preview"
                  className="camera-modal__preview"
                />
              )}
              {/* Crosshair guide */}
              {!snapshot && !starting && (
                <div className="camera-modal__guide" aria-hidden="true" />
              )}
            </>
          )}
          <canvas ref={canvasRef} className="camera-modal__canvas" />
        </div>

        {/* Controls */}
        <div className="camera-modal__controls">
          {!snapshot ? (
            <>
              {/* Flip camera */}
              <button
                className="camera-modal__control-btn"
                aria-label="Flip camera"
                onClick={handleFlip}
                disabled={!!error || starting}
              >
                <Renew size={22} />
              </button>

              {/* Shutter */}
              <button
                className="camera-modal__shutter"
                aria-label="Take photo"
                onClick={handleShutter}
                disabled={!!error || starting}
              />

              {/* Spacer for symmetry */}
              <div style={{ width: '2.75rem' }} />
            </>
          ) : (
            <>
              {/* Retake */}
              <button
                className="camera-modal__control-btn camera-modal__control-btn--label"
                onClick={handleRetake}
              >
                Retake
              </button>

              {/* Use photo */}
              <button
                className="camera-modal__use-btn"
                aria-label="Use photo"
                onClick={handleConfirm}
              >
                <CheckmarkFilled size={26} />
              </button>

              <div style={{ width: '4rem' }} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
