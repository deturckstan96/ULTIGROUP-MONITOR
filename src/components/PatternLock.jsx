import { useRef, useState, useEffect, useCallback } from 'react'

// Correct patroon: 1→4→7→8  (0-gebaseerde indices: 0,3,6,7)
const CORRECT_PATTERN = [0, 3, 6, 7]
const UNLOCK_KEY = 'ulti_unlocked'

const COLS = 3
const DOT_RADIUS = 28
const GRID_SIZE = 240  // totale breedte/hoogte van het grid

function dotCenter(idx) {
  const col = idx % COLS
  const row = Math.floor(idx / COLS)
  const step = GRID_SIZE / COLS  // afstand tussen dots
  const offset = step / 2
  return {
    x: offset + col * step,
    y: offset + row * step,
  }
}

export function isUnlocked() {
  return localStorage.getItem(UNLOCK_KEY) === '1'
}

export default function PatternLock({ onUnlock }) {
  const svgRef      = useRef(null)
  const [selected, setSelected]   = useState([])   // dot indices in volgorde
  const [current,  setCurrent]    = useState(null) // huidige vinger positie {x,y}
  const [state, setState]         = useState('idle') // idle | drawing | success | error
  const drawingRef = useRef(false)

  function reset() {
    setSelected([])
    setCurrent(null)
    setState('idle')
    drawingRef.current = false
  }

  function checkPattern(seq) {
    if (seq.length !== CORRECT_PATTERN.length) return false
    return seq.every((v, i) => v === CORRECT_PATTERN[i])
  }

  function getSVGPos(e) {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const touch = e.touches?.[0] ?? e
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    }
  }

  function hitDot(pos) {
    for (let i = 0; i < 9; i++) {
      const c = dotCenter(i)
      const dx = pos.x - c.x
      const dy = pos.y - c.y
      if (Math.sqrt(dx * dx + dy * dy) < DOT_RADIUS) return i
    }
    return -1
  }

  const onStart = useCallback((e) => {
    e.preventDefault()
    if (state === 'success') return
    reset()
    drawingRef.current = true
    setState('drawing')
    const pos = getSVGPos(e)
    if (!pos) return
    const hit = hitDot(pos)
    if (hit >= 0) setSelected([hit])
    setCurrent(pos)
  }, [state])

  const onMove = useCallback((e) => {
    e.preventDefault()
    if (!drawingRef.current) return
    const pos = getSVGPos(e)
    if (!pos) return
    setCurrent(pos)
    const hit = hitDot(pos)
    if (hit >= 0) {
      setSelected(prev => prev.includes(hit) ? prev : [...prev, hit])
    }
  }, [])

  const onEnd = useCallback((e) => {
    e.preventDefault()
    if (!drawingRef.current) return
    drawingRef.current = false
    setCurrent(null)
    setSelected(prev => {
      const ok = checkPattern(prev)
      setState(ok ? 'success' : 'error')
      if (ok) {
        localStorage.setItem(UNLOCK_KEY, '1')
        setTimeout(() => onUnlock(), 600)
      } else {
        setTimeout(() => reset(), 900)
      }
      return prev
    })
  }, [onUnlock])

  // Teken lijnen tussen geselecteerde dots
  function renderLines() {
    const lines = []
    const color = state === 'error' ? '#ef4444' : state === 'success' ? '#22c55e' : '#3b82f6'
    for (let i = 1; i < selected.length; i++) {
      const a = dotCenter(selected[i - 1])
      const b = dotCenter(selected[i])
      lines.push(
        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      )
    }
    // Lijn naar huidige vinger
    if (current && selected.length > 0 && state === 'drawing') {
      const last = dotCenter(selected[selected.length - 1])
      lines.push(
        <line key="cur" x1={last.x} y1={last.y} x2={current.x} y2={current.y}
          stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      )
    }
    return lines
  }

  function renderDots() {
    const color = state === 'error' ? '#ef4444' : state === 'success' ? '#22c55e' : '#3b82f6'
    return Array.from({ length: 9 }, (_, i) => {
      const c = dotCenter(i)
      const active = selected.includes(i)
      return (
        <g key={i}>
          {/* buitenste ring */}
          <circle cx={c.x} cy={c.y} r={DOT_RADIUS}
            fill="transparent"
            stroke={active ? color : 'rgba(255,255,255,0.2)'}
            strokeWidth={active ? 2 : 1.5} />
          {/* binnenste stip */}
          <circle cx={c.x} cy={c.y} r={active ? 8 : 5}
            fill={active ? color : 'rgba(255,255,255,0.5)'} />
        </g>
      )
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0f2748',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.5px' }}>
        UltiGroup Monitor
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', marginBottom: 56 }}>
        {state === 'error'   ? 'Fout patroon, probeer opnieuw' :
         state === 'success' ? 'Welkom ✓' :
         'Teken uw patroon'}
      </div>

      <svg
        ref={svgRef}
        width={GRID_SIZE}
        height={GRID_SIZE}
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
      >
        {renderLines()}
        {renderDots()}
      </svg>
    </div>
  )
}
