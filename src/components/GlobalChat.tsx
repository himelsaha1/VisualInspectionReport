import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@carbon/react'
import {
  Watson,
  SendFilled,
  Microphone,
  MicrophoneFilled,
  ChevronDown,
} from '@carbon/icons-react'
import {
  generateReply,
  makeMessageId,
  nowLabel,
} from '@/services/chat.service'
import type { GlobalChatMessage, ChatContext } from '@/services/chat.service'
import './GlobalChat.scss'

// ── Constants ─────────────────────────────────────────────────────────────────

const FAB_SIZE      = 52           // px — matches CSS .gchat-fab width/height
const DRAG_THRESH   = 6            // px — movement beyond this = drag, not tap
const STORAGE_KEY   = 'gchat_fab_pos'

// Safe insets — keep FAB away from nav rail (left) and header (top)
const INSET_TOP     = 56           // below Carbon header
const INSET_LEFT    = 52           // right of Carbon side-nav rail
const INSET_BOTTOM  = 20
const INSET_RIGHT   = 20
const INSET_BOTTOM_MOBILE = 76     // above mobile tab bar (≈3.5rem + margin)

// ── Default / persist helpers ─────────────────────────────────────────────────

function defaultPos(): { x: number; y: number } {
  const x = window.innerWidth  - FAB_SIZE - INSET_RIGHT
  const y = window.innerHeight - FAB_SIZE - INSET_BOTTOM
  return { x, y }
}

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { x: number; y: number }
      if (typeof p.x === 'number' && typeof p.y === 'number') return p
    }
  } catch { /* ignore */ }
  return defaultPos()
}

function savePos(pos: { x: number; y: number }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)) } catch { /* ignore */ }
}

/** Clamp FAB position to stay fully inside safe viewport area */
function clamp(x: number, y: number, isMobile: boolean): { x: number; y: number } {
  const maxX = window.innerWidth  - FAB_SIZE - INSET_RIGHT
  const maxY = window.innerHeight - FAB_SIZE - (isMobile ? INSET_BOTTOM_MOBILE : INSET_BOTTOM)
  return {
    x: Math.max(INSET_LEFT, Math.min(x, maxX)),
    y: Math.max(INSET_TOP,  Math.min(y, maxY)),
  }
}

/**
 * Determine which quadrant the FAB is in and return the CSS class
 * that will make the panel grow away from the nearest corner.
 *
 * Quadrant labels relative to viewport centre:
 *   bottom-right → panel grows up-left   (default)
 *   bottom-left  → panel grows up-right
 *   top-right    → panel grows down-left
 *   top-left     → panel grows down-right
 */
function panelQuadrant(fabX: number, fabY: number): string {
  const cx = window.innerWidth  / 2
  const cy = window.innerHeight / 2
  const right  = fabX + FAB_SIZE / 2 >= cx
  const bottom = fabY + FAB_SIZE / 2 >= cy
  if (right  && bottom)  return 'gchat-panel--br'
  if (!right && bottom)  return 'gchat-panel--bl'
  if (right  && !bottom) return 'gchat-panel--tr'
  return 'gchat-panel--tl'
}

// ── Screen greeting ───────────────────────────────────────────────────────────

const SCREEN_GREETINGS: Record<string, string> = {
  '/':            'Hi — I can help start an inspection, answer questions, or take actions on screen.',
  '/inspections': 'Inspection history. Ask about any record, filter by status, or ask me to start a new one.',
  '/dashboard':   'Dashboard. Ask about KPIs, trends, or what any metric means.',
  '/settings':    'Settings. Ask about the connected environment, theme, or account.',
}

function getGreeting(pathname: string): string {
  if (SCREEN_GREETINGS[pathname]) return SCREEN_GREETINGS[pathname]
  if (pathname.includes('/analysis'))   return 'AI Review. Ask why something was flagged, or tell me to submit or discard this inspection.'
  if (pathname.includes('/work-order')) return 'Work order. Ask me about priority, asset details, or how to fill in any field.'
  return 'Ask me anything — questions, navigation, or in-app actions.'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GlobalChat() {
  const location = useLocation()
  const navigate = useNavigate()
  const params   = useParams<{ id?: string }>()

  // ── FAB position (draggable, persisted) ────────────────────────────────────
  const [pos,      setPos]     = useState<{ x: number; y: number }>(loadPos)
  const [dragging, setDragging]= useState(false)
  const dragState = useRef<{
    startX: number; startY: number
    fabX:   number; fabY:   number
    moved:  boolean
  } | null>(null)

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [open,      setOpen]     = useState(false)
  const [messages,  setMessages] = useState<GlobalChatMessage[]>([])
  const [input,     setInput]    = useState('')
  const [aiTyping,  setAiTyping] = useState(false)
  const [listening, setListening]= useState(false)
  const [greeted,   setGreeted]  = useState<string>('')

  const threadEndRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const panelRef     = useRef<HTMLDivElement>(null)
  const fabRef       = useRef<HTMLButtonElement>(null)

  const isMobile = () => window.innerWidth <= 671

  // Route context
  const ctx: ChatContext = {
    pathname:     location.pathname,
    inspectionId: params.id,
  }

  // ── Clamp on resize ────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      setPos(prev => {
        const clamped = clamp(prev.x, prev.y, isMobile())
        savePos(clamped)
        return clamped
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Pointer drag handlers ──────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only left-click / primary touch
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      fabX:   pos.x,
      fabY:   pos.y,
      moved:  false,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY

    if (!dragState.current.moved && Math.hypot(dx, dy) < DRAG_THRESH) return
    dragState.current.moved = true
    if (!dragging) setDragging(true)

    const newPos = clamp(
      dragState.current.fabX + dx,
      dragState.current.fabY + dy,
      isMobile(),
    )
    setPos(newPos)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState.current) return
    const wasDrag = dragState.current.moved
    dragState.current = null
    setDragging(false)

    if (!wasDrag) {
      // It was a tap — toggle panel
      setOpen(v => !v)
    } else {
      // Persist final position
      savePos(pos)
    }
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // ── Auto-scroll thread ─────────────────────────────────────────────────────
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiTyping])

  // ── Greet once per screen (only when panel is open) ────────────────────────
  useEffect(() => {
    if (!open) return
    const key = location.pathname
    if (greeted === key) return
    setGreeted(key)
    setMessages(prev => [
      ...prev,
      { id: makeMessageId(), role: 'ai', text: getGreeting(key), timestamp: nowLabel() },
    ])
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [open, location.pathname, greeted])

  // ── ESC closes panel ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  // ── Outside-click closes panel ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      const fab   = fabRef.current
      const panel = panelRef.current
      if (fab?.contains(e.target as Node) || panel?.contains(e.target as Node)) return
      setOpen(false)
    }
    const t = setTimeout(() => document.addEventListener('mousedown', h), 150)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h) }
  }, [open])

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || aiTyping) return
    setInput('')

    const userMsg: GlobalChatMessage = {
      id: makeMessageId(), role: 'user', text: trimmed, timestamp: nowLabel(),
    }
    setMessages(prev => [...prev, userMsg])
    setAiTyping(true)

    try {
      const reply = await generateReply(trimmed, ctx, messages)
      setMessages(prev => [
        ...prev,
        { id: makeMessageId(), role: 'ai', text: reply.text, timestamp: nowLabel(), action: reply.action },
      ])
      if (reply.action?.path) {
        setTimeout(() => { navigate(reply.action!.path!); setOpen(false) }, 600)
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { id: makeMessageId(), role: 'ai', text: 'I had trouble processing that — please try again.', timestamp: nowLabel() },
      ])
    } finally {
      setAiTyping(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiTyping, messages, navigate])

  // ── Voice ──────────────────────────────────────────────────────────────────
  const toggleMic = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice input not supported in this browser.'); return }
    const rec = new SR()
    rec.lang = 'en-US'; rec.interimResults = false
    setListening(true)
    rec.onresult = (e: { results: { [x: number]: { [x: number]: { transcript: string } } } }) => {
      setInput(prev => prev + (prev ? ' ' : '') + e.results[0][0].transcript)
      setListening(false)
    }
    rec.onerror = () => setListening(false)
    rec.onend   = () => setListening(false)
    rec.start()
  }

  // ── Panel position (inline styles, anchored to FAB) ────────────────────────
  // Work out which quadrant the FAB is in and build panel position accordingly
  const qClass  = panelQuadrant(pos.x, pos.y)
  const onMobile = isMobile()

  // FAB inline style
  const fabStyle: React.CSSProperties = {
    left: pos.x,
    top:  pos.y,
    cursor: dragging ? 'grabbing' : 'grab',
  }

  // Panel inline style — anchored to the FAB edge depending on quadrant
  let panelStyle: React.CSSProperties = {}
  if (!onMobile) {
    const right  = qClass === 'gchat-panel--br' || qClass === 'gchat-panel--tr'
    const bottom = qClass === 'gchat-panel--br' || qClass === 'gchat-panel--bl'
    panelStyle = {
      left:   right  ? undefined : pos.x,
      right:  right  ? window.innerWidth - pos.x - FAB_SIZE : undefined,
      top:    bottom ? undefined : pos.y + FAB_SIZE + 8,
      bottom: bottom ? window.innerHeight - pos.y + 8 : undefined,
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── FAB — always present ── */}
      <button
        ref={fabRef}
        type="button"
        className={`gchat-fab${dragging ? ' gchat-fab--dragging' : ''}`}
        style={fabStyle}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        // Prevent context menu on long-press mobile
        onContextMenu={e => e.preventDefault()}
      >
        {open
          ? <ChevronDown size={20} />
          : <Watson size={22} />
        }
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          ref={panelRef}
          className={`gchat-panel ${qClass}`}
          style={panelStyle}
          role="dialog"
          aria-modal="false"
          aria-label="AI assistant"
        >
          <div className="gchat-panel__header">
            <div className="gchat-panel__title">
              <Watson size={16} />
              <span>Ask about this app</span>
            </div>
            <button
              type="button"
              className="gchat-panel__close"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
            >
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="gchat-panel__thread" role="log" aria-live="polite">
            {messages.length === 0 && (
              <p className="gchat-panel__empty">
                Ask anything — questions about inspections, records, or "go to dashboard."
              </p>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`gchat-bubble gchat-bubble--${msg.role}`}>
                <div className="gchat-bubble__text">{msg.text}</div>
                {msg.action && (
                  <div className="gchat-bubble__action">↗ {msg.action.label}</div>
                )}
                <div className="gchat-bubble__time">{msg.timestamp}</div>
              </div>
            ))}
            {aiTyping && (
              <div className="gchat-typing"><span /><span /><span /></div>
            )}
            <div ref={threadEndRef} />
          </div>

          <div className="gchat-panel__input-row">
            <textarea
              ref={inputRef}
              className="gchat-panel__input"
              placeholder="Ask a question or give a command…"
              value={input}
              rows={1}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
              }}
              aria-label="Chat input"
            />
            <button
              type="button"
              className={`gchat-mic${listening ? ' gchat-mic--active' : ''}`}
              aria-label={listening ? 'Stop recording' : 'Voice input'}
              onClick={toggleMic}
            >
              {listening ? <MicrophoneFilled size={16} /> : <Microphone size={16} />}
            </button>
            <Button
              size="sm"
              hasIconOnly
              renderIcon={SendFilled}
              iconDescription="Send"
              onClick={() => send(input)}
              disabled={!input.trim() || aiTyping}
            />
          </div>
        </div>
      )}
    </>
  )
}
