import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

function dagStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function weekStart(offset = 0) {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1 + offset * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function dagNaam(d) {
  return new Date(d).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric' })
}

function fmtTijd(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
}

function isVandaag(iso) {
  if (!iso) return false
  const d = new Date(iso), n = new Date()
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

function dagGroet() {
  const h = new Date().getHours()
  return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'
}

// ── Productiegrafiek ──────────────────────────────────────────────────────────
function ProductieGrafiek() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [data, setData] = useState([])

  useEffect(() => {
    async function load() {
      const start = weekStart(weekOffset)
      const end   = new Date(start); end.setDate(end.getDate() + 7)
      const [{ data: pallets }, { data: werkorders }] = await Promise.all([
        supabase.from('pallet_boekingen').select('qty, created_at').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
        supabase.from('werkorder_boekingen').select('qty, geboekt_at').gte('geboekt_at', start.toISOString()).lt('geboekt_at', end.toISOString()),
      ])
      const dagMap = {}
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i)
        dagMap[d.toDateString()] = { datum: d, qty: 0 }
      }
      for (const r of [...(pallets || []), ...(werkorders || [])]) {
        const key = new Date(r.created_at || r.geboekt_at).toDateString()
        if (dagMap[key]) dagMap[key].qty += (r.qty || 0)
      }
      setData(Object.values(dagMap))
    }
    load()
  }, [weekOffset])

  const maxQty = Math.max(1, ...data.map(d => d.qty))
  const svgH = 60, barW = 30, gap = 10
  const totaal = data.reduce((s, d) => s + d.qty, 0)
  const isHuidigeWeek = weekOffset === 0
  const startLabel = data[0]?.datum ? new Date(data[0].datum).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) : ''
  const eindLabel  = data[6]?.datum ? new Date(data[6].datum).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) : ''

  return (
    <div className="card card-body" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Productie — stuks/week</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{startLabel} – {eindLabel} · {totaal} st</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-icon" onClick={() => setWeekOffset(v => v - 1)}>←</button>
          {!isHuidigeWeek && <button className="btn-sm" onClick={() => setWeekOffset(0)}>Nu</button>}
          <button className="btn-icon" onClick={() => setWeekOffset(v => Math.min(0, v + 1))} disabled={isHuidigeWeek} style={{ opacity: isHuidigeWeek ? 0.3 : 1 }}>→</button>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${data.length * (barW + gap)} ${svgH + 22}`} style={{ overflow: 'visible' }}>
        {data.map((d, i) => {
          const barH = Math.max(4, Math.round(d.qty / maxQty * svgH))
          const x = i * (barW + gap)
          const today = isVandaag(d.datum)
          return (
            <g key={i}>
              <rect x={x} y={svgH - barH} width={barW} height={barH} rx={4}
                fill={today ? '#2563eb' : d.qty > 0 ? '#93c5fd' : '#e2e8f0'} />
              {d.qty > 0 && (
                <text x={x + barW / 2} y={svgH - barH - 3} textAnchor="middle" fontSize={9} fill="#475569" fontWeight={600}>{d.qty}</text>
              )}
              <text x={x + barW / 2} y={svgH + 14} textAnchor="middle" fontSize={9}
                fill={today ? '#2563eb' : '#94a3b8'} fontWeight={today ? 700 : 400}>
                {dagNaam(d.datum)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── KPI tile ─────────────────────────────────────────────────────────────────
function KpiTile({ count, label, color, bg }) {
  return (
    <div style={{ flex: 1, background: bg || '#fff', borderRadius: 14, padding: '14px 8px', textAlign: 'center', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: color || 'var(--navy)', lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 11, color: color || 'var(--text3)', fontWeight: 600, marginTop: 4 }}>{label}</div>
    </div>
  )
}

// ── Hoofd ────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [kpi, setKpi] = useState({ pallets: 0, vertrokken: 0, ontvangen: 0 })
  const [geplandUit, setGeplandUit] = useState([])
  const [loading, setLoading] = useState(true)
  const [laasteActies, setLaatsteActies] = useState([])

  useEffect(() => {
    async function load() {
      const vandaag = dagStart()
      const [pb, wb, sd, pd, guit, wbActies] = await Promise.all([
        supabase.from('pallet_boekingen').select('qty').gte('created_at', vandaag),
        supabase.from('werkorder_boekingen').select('qty').gte('geboekt_at', vandaag),
        supabase.from('sales_delivery').select('delivery_id', { count: 'exact' }).eq('status', 'Vertrokken').gte('updated_at', vandaag),
        supabase.from('purch_delivery').select('delivery_id', { count: 'exact' }).neq('status', 'Waak').gte('updated_at', vandaag),
        supabase.from('sales_delivery').select('delivery_id, customer_name, klant_naam, delivery_date, status').eq('status', 'Ready').order('delivery_date', { ascending: true }).limit(5),
        supabase.from('werkorder_boekingen').select('werkorder_nr, qty, geboekt_at, werkorders(naam, uga)').gte('geboekt_at', vandaag).order('geboekt_at', { ascending: false }).limit(8),
      ])
      const palletsTotaal = (pb.data || []).reduce((s, r) => s + (r.qty || 0), 0)
                          + (wb.data || []).reduce((s, r) => s + (r.qty || 0), 0)
      setKpi({
        pallets: palletsTotaal,
        vertrokken: sd.count || 0,
        ontvangen: pd.count || 0,
      })
      setGeplandUit(guit.data || [])
      setLaatsteActies(wbActies.data || [])
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  const dag = new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })
  const uitVandaag = geplandUit.filter(d => isVandaag(d.delivery_date))

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{dagGroet()}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, textTransform: 'capitalize' }}>{dag}</div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <KpiTile count={loading ? '…' : kpi.pallets} label="Pallets" color="#2563eb" bg="#eff6ff" />
        <KpiTile count={loading ? '…' : kpi.vertrokken} label="Vertrokken" color="#16a34a" bg="#f0fdf4" />
        <KpiTile count={loading ? '…' : kpi.ontvangen} label="Ontvangen" color="#d97706" bg="#fffbeb" />
      </div>

      {/* Productiegrafiek */}
      <ProductieGrafiek />

      {/* Laatste acties vandaag */}
      {laasteActies.length > 0 && (
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            Laatste acties vandaag
          </div>
          {laasteActies.map((r, i) => {
            const naam = r.werkorders?.uga || r.werkorders?.naam || r.werkorder_nr
            const tijd = new Date(r.geboekt_at).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < laasteActies.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--navy)' }}>{naam}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#16a34a' }}>+{r.qty} st</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tijd}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Vandaag urgent */}
      {uitVandaag.length > 0 && (
        <div style={{ background: '#fef9c3', borderRadius: 12, padding: '12px 14px', marginBottom: 14, border: '1px solid #fde047' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>⚡ Vertrekt vandaag</div>
          {uitVandaag.map(d => (
            <div key={d.delivery_id} style={{ fontSize: 13, color: '#92400e', fontWeight: 600, marginBottom: 2 }}>
              🚛 {d.customer_name || d.klant_naam} — {d.delivery_id}
            </div>
          ))}
        </div>
      )}

      {/* Gepland UIT */}
      {geplandUit.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            🚛 Nog te vertrekken ({geplandUit.length})
          </div>
          {geplandUit.map(d => (
            <div key={d.delivery_id} className="card" style={{ padding: '10px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: isVandaag(d.delivery_date) ? '3px solid #fde047' : '3px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{d.customer_name || d.klant_naam}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{d.delivery_id}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: isVandaag(d.delivery_date) ? '#dc2626' : 'var(--text2)' }}>
                {d.delivery_date ? new Date(d.delivery_date).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) : '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && geplandUit.length === 0 && kpi.pallets === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✓</div>
          <div className="empty-title">Rustige dag</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Geen openstaande zendingen.</div>
        </div>
      )}
    </div>
  )
}
