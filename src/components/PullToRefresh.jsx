import { useRef, useState, useCallback } from 'react'

const THRESHOLD = 65   // px trekken voor refresh
const MAX_PULL  = 90   // max visuele afstand

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDist, setPullDist] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const startYRef    = useRef(null)
  const scrollElRef  = useRef(null)

  const onTouchStart = useCallback((e) => {
    const el = scrollElRef.current
    if (!el || el.scrollTop > 0) return
    startYRef.current = e.touches[0].clientY
  }, [])

  const onTouchMove = useCallback((e) => {
    if (startYRef.current === null) return
    const el = scrollElRef.current
    if (!el || el.scrollTop > 0) { startYRef.current = null; return }

    const dist = e.touches[0].clientY - startYRef.current
    if (dist <= 0) { startYRef.current = null; return }

    // Voorkom native scroll gedrag tijdens pull
    e.preventDefault()
    setPullDist(Math.min(dist * 0.5, MAX_PULL))
  }, [])

  const onTouchEnd = useCallback(async () => {
    if (startYRef.current === null) { setPullDist(0); return }
    startYRef.current = null

    if (pullDist >= THRESHOLD) {
      setRefreshing(true)
      setPullDist(45) // houd indicator zichtbaar tijdens laden
      await onRefresh()
      setRefreshing(false)
    }
    setPullDist(0)
  }, [pullDist, onRefresh])

  const showIndicator = pullDist > 5 || refreshing
  const klaar = pullDist >= THRESHOLD

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Pull indicator */}
      {showIndicator && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: `${refreshing ? 45 : pullDist}px`,
          background: 'linear-gradient(to bottom, #0f2748, transparent)',
          transition: refreshing ? 'height .2s' : 'none',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'rgba(255,255,255,.9)', fontSize: 12, fontWeight: 600,
            opacity: pullDist > 20 || refreshing ? 1 : 0,
            transition: 'opacity .15s',
          }}>
            {refreshing ? (
              <>
                <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
                Verversen…
              </>
            ) : klaar ? (
              <><span>↑</span> Loslaten om te verversen</>
            ) : (
              <><span>↓</span> Trek om te verversen</>
            )}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div
        ref={scrollElRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          transform: pullDist > 0 ? `translateY(${pullDist}px)` : 'none',
          transition: pullDist === 0 ? 'transform .25s ease' : 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
