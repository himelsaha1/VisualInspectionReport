import { useEffect, useRef } from 'react'
import type { Detection } from '@/types'

interface BoundingBoxCanvasProps {
  imageUrl: string
  detections: Detection[]
}

const SEVERITY_COLORS: Record<Detection['severity'], string> = {
  high: '#da1e28',    // Carbon red-60
  medium: '#ff832b',  // Carbon orange-40
  low: '#0f62fe',     // Carbon blue-60
}

export function BoundingBoxCanvas({ imageUrl, detections }: BoundingBoxCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const drawBoxes = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      detections.forEach(({ bbox, label, confidence, severity }) => {
        const [xNorm, yNorm, wNorm, hNorm] = bbox
        const x = xNorm * canvas.width
        const y = yNorm * canvas.height
        const w = wNorm * canvas.width
        const h = hNorm * canvas.height

        const color = SEVERITY_COLORS[severity]

        // Box
        ctx.strokeStyle = color
        ctx.lineWidth = 2.5
        ctx.strokeRect(x, y, w, h)

        // Label background
        const text = `${label} ${confidence.toFixed(0)}%`
        ctx.font = 'bold 12px IBM Plex Sans, sans-serif'
        const textWidth = ctx.measureText(text).width
        ctx.fillStyle = color
        ctx.fillRect(x, y - 18, textWidth + 8, 18)

        // Label text
        ctx.fillStyle = '#ffffff'
        ctx.fillText(text, x + 4, y - 4)
      })
    }

    if (img.complete && img.naturalWidth > 0) {
      drawBoxes()
    } else {
      img.onload = drawBoxes
    }
  }, [imageUrl, detections])

  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Inspection image"
        style={{ display: 'block', maxWidth: '100%', maxHeight: '28rem', objectFit: 'contain' }}
        crossOrigin="anonymous"
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
