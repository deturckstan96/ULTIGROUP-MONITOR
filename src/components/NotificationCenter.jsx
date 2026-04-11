import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

const LS_KEY = 'notif_last_seen'

const EVENT_ICONS = {
  gepland_uit: { icon: '📤', kleur: '#0284c7', bg: '#f0f9ff', label: 'Gepland UIT' },
  vertrokken:  { icon: '🚛', kleur: '#16a34a', bg: '#f0fdf4', label: 'Vertrokken' },
  gepland_in:  { icon: '🗓', kleur: '#7c3aed', bg: '#f5f3ff', label: 'Gepland IN' },
  levering_in: { icon: '📦', kleur: '#d97706', bg: '#fffbeb', label: 'Levering ontvangen' },
  pallet:      { icon: '🪵', kleur: '#2563eb', bg: '#eff6ff', label: 'Pallet geboekt' },
  werkorder:   { icon: '⚙️', kleur: '#7c3aed', bg: '#f5f3ff', label: 'Werkorder' },
}

function fmtTijd(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const nu = new Date()
  const diffMin = Math.floor((nu - d) / 60000)
  if (diffMin < 1)  return 'zojuist'
  if (diffMin < 60) return `${diffMin}m`
  if (diffMin < 1440) return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
}

async function fetchEvents() {
  const since = new Date()
  since.setDate(since.getDate() - 2)
  const sinceIso = since.toISOString()

  const [geplandUit, vertrokken, geplandIn, leveringen, pallets, werkorders] = await Promise.all([
    supabase.from('sales_delivery')
      .select('delivery_id, customer_name, klant_naam, updated_at')
      .eq('status', 'Ready')
      .gte('updated_at', sinceIso)
      .order('updated_at', { ascending: false })
      .limit(15),
    supabase.from('sales_delivery')
      .select('delivery_id, customer_name, klant_naam, updated_at')
      .in('status', ['Posted', 'Vertrokken'])
      .gte('updated_at', sinceIso)
      .order('updated_at', { ascending: false })
      .limit(15),
    supabase.from('purch_delivery')
      .select('delivery_id, supplier_name, updated_at')
      .eq('status', 'Waak')
      .gte('updated_at', sinceIso)
      .order('updated_at', { ascending: false })
      .limit(15),
    supabase.from('purch_delivery')
      .select('delivery_id, supplier_name, updated_at')
      .eq('status', 'Posted')
      .gte('updated_at', sinceIso)
      .order('updated_at', { ascending: false })
      .limit(15),
    supabase.from('pallet_boekingen')
      .select('id, pallet_naam, pallet_nr, qty, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('werkorder_boekingen')
      .select('id, werkorder_nr, qty, geboekt_at, werkorders(naam, uga)')
      .gte('geboekt_at', sinceIso)
      .order('geboekt_at', { ascending: false })
      .limit(20),
  ])

  const feed = []
  for (const r of geplandUit.data || [])
    feed.push({ type: 'gepland_uit', titel: `${r.customer_name || r.klant_naam || r.delivery_id} gepland UIT`, sub: r.delivery_id, tijd: r.updated_at })
  for (const r of vertrokken.data || [])
    feed.push({ type: 'vertrokken', titel: `${r.customer_name || r.klant_naam || r.delivery_id} vertrokken`, sub: r.delivery_id, tijd: r.updated_at })
  for (const r of geplandIn.data || [])
    feed.push({ type: 'gepland_in', titel: `${r.supplier_name || r.delivery_id} gepland IN`, sub: r.delivery_id, tijd: r.updated_at })
  for (const r of leveringen.data || [])
    feed.push({ type: 'levering_in', titel: `${r.supplier_name || r.delivery_id} ontvangen`, sub: r.delivery_id, tijd: r.updated_at })
  for (const r of pallets.data || [])
    feed.push({ type: 'pallet', titel: `${r.pallet_naam || r.pallet_nr} — ${r.qty} stuks`, sub: `Lot #${r.id}`, tijd: r.created_at })
  for (const r of werkorders.data || [])
    feed.push({ type: 'werkorder', titel: `${r.werkorders?.naam || r.werkorders?.uga || r.werkorder_nr} — ${r.qty} stuks`, sub: r.werkorder_nr, tijd: r.geboekt_at })

  feed.sort((a, b) => new Date(b.tijd) - new Date(a.tijd))
  return feed
}

export default function NotificationCenter({ open, onClose, onUnreadChange }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  function computeUnread(events) {
    const lastSeen = localStorage.getItem(LS_KEY)
    if (!lastSeen) return events.length
    return events.filter(e => new Date(e.tijd) > new Date(lastSeen)).length
  }

  async function load() {
    const events = await fetchEvents()
    setItems(events)
    setLoading(false)
  }

  // Poll elke 30s
  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, 30_000)
    return () => clearInterval(intervalRef.current)
  }, [])

  // Unread count apart bijhouden zodat het niet tijdens render van App wordt gezet
  useEffect(() => {
    onUnreadChange?.(computeUnread(items))
  }, [items])

  // Markeer als gelezen bij openen
  useEffect(() => {
    if (open) {
      localStorage.setItem(LS_KEY, new Date().toISOString())
      onUnreadChange?.(0)
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,.35)',
        }}
      />

      {/* Paneel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(340px, 92vw)',
        background: '#fff',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,.15)',
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--navy)', color: '#fff',
          padding: 'max(env(safe-area-inset-top,0px),16px) 16px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Meldingen</div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.15)', border: 'none',
            borderRadius: 8, color: '#fff', fontSize: 14,
            padding: '5px 10px', cursor: 'pointer', fontWeight: 700,
          }}>✕</button>
        </div>

        {/* Lijst */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Laden…</div>
          )}
          {!loading && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Geen recente meldingen</div>
            </div>
          )}
          {items.map((item, i) => {
            const e = EVENT_ICONS[item.type] || EVENT_ICONS.pallet
            return (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '11px 16px',
                borderBottom: '1px solid var(--border)',
                background: '#fff',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: e.bg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 17, flexShrink: 0,
                }}>
                  {e.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 1 }}>{item.titel}</div>
                  {item.sub && <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', paddingTop: 2, flexShrink: 0 }}>
                  {fmtTijd(item.tijd)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
