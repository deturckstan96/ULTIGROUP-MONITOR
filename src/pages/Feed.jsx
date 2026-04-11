import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

function fmtTijd(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const nu = new Date()
  const diffMin = Math.floor((nu - d) / 60000)
  if (diffMin < 1)  return 'zojuist'
  if (diffMin < 60) return `${diffMin} min geleden`
  if (diffMin < 1440) return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const EVENT_ICONS = {
  gepland_uit:  { icon: '📤', kleur: '#0284c7', bg: '#f0f9ff', label: 'Gepland UIT' },
  vertrokken:   { icon: '🚛', kleur: '#16a34a', bg: '#f0fdf4', label: 'Vertrokken' },
  gepland_in:   { icon: '🗓', kleur: '#7c3aed', bg: '#f5f3ff', label: 'Gepland IN' },
  levering_in:  { icon: '📦', kleur: '#d97706', bg: '#fffbeb', label: 'Levering ontvangen' },
  pallet:       { icon: '🪵', kleur: '#2563eb', bg: '#eff6ff', label: 'Pallet geboekt' },
  werkorder:    { icon: '⚙️', kleur: '#7c3aed', bg: '#f5f3ff', label: 'Werkorder' },
}

function FeedItem({ type, titel, sub, tijd }) {
  const e = EVENT_ICONS[type] || EVENT_ICONS.pallet
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: e.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
        {e.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>{titel}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 2 }}>{fmtTijd(tijd)}</div>
    </div>
  )
}

export default function Feed() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const since = new Date()
      since.setDate(since.getDate() - 7)
      const sinceIso = since.toISOString()

      const [geplandUit, vertrokken, geplandIn, leveringen, pallets, werkorders] = await Promise.all([
        supabase.from('sales_delivery')
          .select('delivery_id, customer_name, klant_naam, updated_at')
          .eq('status', 'Ready')
          .gte('updated_at', sinceIso)
          .order('updated_at', { ascending: false })
          .limit(20),
        supabase.from('sales_delivery')
          .select('delivery_id, customer_name, klant_naam, updated_at')
          .in('status', ['Posted', 'Vertrokken'])
          .gte('updated_at', sinceIso)
          .order('updated_at', { ascending: false })
          .limit(20),
        supabase.from('purch_delivery')
          .select('delivery_id, supplier_name, updated_at')
          .eq('status', 'Waak')
          .gte('updated_at', sinceIso)
          .order('updated_at', { ascending: false })
          .limit(20),
        supabase.from('purch_delivery')
          .select('delivery_id, supplier_name, updated_at')
          .eq('status', 'Posted')
          .gte('updated_at', sinceIso)
          .order('updated_at', { ascending: false })
          .limit(20),
        supabase.from('pallet_boekingen')
          .select('id, pallet_naam, pallet_nr, qty, created_at')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('werkorder_boekingen')
          .select('id, werkorder_nr, qty, geboekt_at, werkorders(naam, uga)')
          .gte('geboekt_at', sinceIso)
          .order('geboekt_at', { ascending: false })
          .limit(30),
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
      setItems(feed)
      setLoading(false)
    }

    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>Activiteit</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Laatste 7 dagen</div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Laden…</div>
      )}

      {!loading && items.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">Geen activiteit</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Nog niets geregistreerd deze week.</div>
        </div>
      )}

      {items.map((item, i) => (
        <FeedItem key={i} {...item} />
      ))}
    </div>
  )
}
