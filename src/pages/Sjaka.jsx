import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'

function dagLabel(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function euro(n) {
  if (n == null || isNaN(n) || n === 0) return '€0'
  return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function euroFull(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDag(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── KPI tile ─────────────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, color, bg, small }) {
  return (
    <div style={{ flex: 1, background: bg || '#fff', borderRadius: 12, padding: small ? '10px 8px' : '12px 10px', textAlign: 'center', border: '1px solid var(--border)', minWidth: 0 }}>
      <div style={{ fontSize: small ? 14 : 18, fontWeight: 800, color: color || 'var(--navy)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ fontSize: 10, color: color || 'var(--text3)', fontWeight: 600, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Marge kleur ───────────────────────────────────────────────────────────────
function MargeKleur({ marge }) {
  if (marge == null) return <span style={{ color: 'var(--text3)' }}>—</span>
  const kleur = marge >= 0 ? '#16a34a' : '#dc2626'
  return <span style={{ color: kleur, fontWeight: 700 }}>{euro(marge)}</span>
}

// ── Preset knop ───────────────────────────────────────────────────────────────
function PresetBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
      background: active ? 'var(--navy)' : '#e2e8f0',
      color: active ? '#fff' : 'var(--text2)',
      fontSize: 13, fontWeight: 600,
    }}>
      {label}
    </button>
  )
}

export default function Sjaka() {
  const vandaag = dagLabel(0)

  const [dagVan, setDagVan]   = useState(vandaag)
  const [dagTot, setDagTot]   = useState(vandaag)
  const [preset, setPreset]   = useState('vandaag')

  const [prodRows, setProdRows] = useState([])
  const [levRows,  setLevRows]  = useState([])
  const [financMap, setFinancMap] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [expandedLev, setExpandedLev] = useState({})

  function applyPreset(p) {
    setPreset(p)
    if (p === 'vandaag')   { setDagVan(dagLabel(0));  setDagTot(dagLabel(0)) }
    if (p === 'gisteren')  { setDagVan(dagLabel(-1)); setDagTot(dagLabel(-1)) }
    if (p === 'week')      { setDagVan(dagLabel(-6)); setDagTot(dagLabel(0)) }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [prodRes, levRes, financRes] = await Promise.all([
        supabase.from('vw_sjaka_productie')
          .select('pallet_nr,pallet_naam,qty,kostprijs_per_stuk,verkooprijs_per_stuk,marge_per_stuk,totaal_marge,ref_so,dag,created_at')
          .gte('dag', dagVan).lte('dag', dagTot)
          .order('created_at', { ascending: false }),
        supabase.from('vw_sjaka_leveringen')
          .select('delivery_id,delivery_ref,customer_name,status,item_id,item_name,qty,kostprijs_per_stuk,verkooprijs_per_stuk,marge_per_stuk,totaal_marge,dag,created_at')
          .gte('dag', dagVan).lte('dag', dagTot)
          .order('created_at', { ascending: false }),
        supabase.from('vw_delivery_financieel')
          .select('delivery_id,omzet_excl,transport_cost,netto,heeft_missende_prijs')
          .gte('posted_at', dagVan).lte('posted_at', dagTot + 'T23:59:59'),
      ])

      setProdRows(prodRes.data || [])
      setLevRows(levRes.data || [])

      const fmap = {}
      for (const r of financRes.data || []) fmap[r.delivery_id] = r
      setFinancMap(fmap)
      setLoading(false)
    }
    load()
  }, [dagVan, dagTot])

  // ── KPI berekeningen ──────────────────────────────────────────────────────
  const prodMarge   = useMemo(() => prodRows.reduce((s, r) => s + (r.totaal_marge || 0), 0), [prodRows])
  const prodQty     = useMemo(() => prodRows.reduce((s, r) => s + (r.qty || 0), 0), [prodRows])
  const onbekendProd = useMemo(() => prodRows.filter(r => r.marge_per_stuk == null).reduce((s, r) => s + (r.qty || 0), 0), [prodRows])

  const levMarge    = useMemo(() => levRows.reduce((s, r) => s + (r.totaal_marge || 0), 0), [levRows])
  const levQty      = useMemo(() => levRows.reduce((s, r) => s + (r.qty || 0), 0), [levRows])
  const onbekendLev = useMemo(() => levRows.filter(r => r.marge_per_stuk == null).reduce((s, r) => s + (r.qty || 0), 0), [levRows])

  const totaalMarge = prodMarge + levMarge
  const perUur      = totaalMarge / 8

  const totOmzet    = Object.values(financMap).reduce((s, r) => s + (r.omzet_excl || 0), 0)
  const totTransport = Object.values(financMap).reduce((s, r) => s + (r.transport_cost || 0), 0)
  const totNetto    = Object.values(financMap).reduce((s, r) => s + (r.netto || 0), 0)
  const heeftFinanc = Object.keys(financMap).length > 0

  // ── Productie groepering ──────────────────────────────────────────────────
  const prodGroepen = useMemo(() => {
    const map = {}
    for (const r of prodRows) {
      if (!map[r.pallet_nr]) map[r.pallet_nr] = { pallet_nr: r.pallet_nr, pallet_naam: r.pallet_naam, qty: 0, totaal_marge: 0, ref_so: r.ref_so }
      map[r.pallet_nr].qty += (r.qty || 0)
      map[r.pallet_nr].totaal_marge += (r.totaal_marge || 0)
    }
    return Object.values(map).sort((a, b) => b.totaal_marge - a.totaal_marge)
  }, [prodRows])

  // ── Levering groepering ───────────────────────────────────────────────────
  const levGroepen = useMemo(() => {
    const map = {}
    for (const r of levRows) {
      if (!map[r.delivery_id]) map[r.delivery_id] = { ...r, lines: [], totaal_marge: 0 }
      map[r.delivery_id].lines.push(r)
      map[r.delivery_id].totaal_marge += (r.totaal_marge || 0)
    }
    return Object.values(map).sort((a, b) => new Date(b.dag) - new Date(a.dag))
  }, [levRows])

  function toggleLev(id) {
    setExpandedLev(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const periodeLabel = dagVan === dagTot ? fmtDag(dagVan) : `${fmtDag(dagVan)} – ${fmtDag(dagTot)}`

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)', letterSpacing: '-0.5px' }}>SJAKA</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Dagelijkse winstrapportage · {periodeLabel}</div>
      </div>

      {/* Preset knoppen */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <PresetBtn label="Vandaag"   active={preset === 'vandaag'}  onClick={() => applyPreset('vandaag')} />
        <PresetBtn label="Gisteren"  active={preset === 'gisteren'} onClick={() => applyPreset('gisteren')} />
        <PresetBtn label="Week"      active={preset === 'week'}     onClick={() => applyPreset('week')} />
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Laden…</div>}

      {!loading && (
        <>
          {/* KPI rij 1 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <KpiTile label="Productie" value={euro(prodMarge)} color={prodMarge >= 0 ? '#16a34a' : '#dc2626'} bg={prodMarge >= 0 ? '#f0fdf4' : '#fee2e2'} sub={onbekendProd > 0 ? `${onbekendProd} onbekend` : null} />
            <KpiTile label="Levering"  value={euro(levMarge)}  color={levMarge >= 0 ? '#16a34a' : '#dc2626'} bg={levMarge >= 0 ? '#f0fdf4' : '#fee2e2'} sub={onbekendLev > 0 ? `${onbekendLev} onbekend` : null} />
            <KpiTile label="Totaal"    value={euro(totaalMarge)} color={totaalMarge >= 0 ? '#16a34a' : '#dc2626'} bg={totaalMarge >= 0 ? '#dcfce7' : '#fee2e2'} />
          </div>

          {/* KPI rij 2 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <KpiTile label="Per uur (8u)" value={euro(perUur)} small color="var(--navy)" bg="#f8fafc" />
            {heeftFinanc && <>
              <KpiTile label="Omzet excl."  value={euro(totOmzet)}     small color="#2563eb" bg="#eff6ff" />
              <KpiTile label="Transport"    value={euro(totTransport)}  small color="#d97706" bg="#fffbeb" />
            </>}
          </div>

          {/* Productie tabel */}
          {prodGroepen.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                ⚙ Productie ({prodQty} st)
              </div>
              {prodGroepen.map(g => (
                <div key={g.pallet_nr} className="card" style={{ padding: '10px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.pallet_naam || g.pallet_nr}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {g.qty} st{g.ref_so ? ` · SO: ${g.ref_so}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                    <MargeKleur marge={g.totaal_marge} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 14px 0', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                Totaal: <span style={{ marginLeft: 8, color: prodMarge >= 0 ? '#16a34a' : '#dc2626' }}>{euroFull(prodMarge)}</span>
              </div>
            </div>
          )}

          {/* Leveringen */}
          {levGroepen.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                🚛 Leveringen ({levGroepen.length})
              </div>
              {levGroepen.map(g => {
                const fin = financMap[g.delivery_id]
                const expanded = !!expandedLev[g.delivery_id]
                return (
                  <div key={g.delivery_id} className="card" style={{ marginBottom: 6 }}>
                    {/* Levering header */}
                    <div
                      onClick={() => toggleLev(g.delivery_id)}
                      style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{g.customer_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                          <span style={{ fontFamily: 'monospace' }}>{g.delivery_ref || g.delivery_id}</span>
                          {g.dag && <span> · {fmtDag(g.dag)}</span>}
                          {fin?.omzet_excl && <span style={{ color: '#2563eb' }}> · {euro(fin.omzet_excl)}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                        <MargeKleur marge={g.totaal_marge} />
                        <span style={{ color: 'var(--text3)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Uitgevouwen lijnen */}
                    {expanded && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px' }}>
                        {g.lines.map((l, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < g.lines.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.item_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.qty} {l.uom || 'st'}</div>
                            </div>
                            <div style={{ fontSize: 12, flexShrink: 0, marginLeft: 8 }}>
                              <MargeKleur marge={l.totaal_marge} />
                            </div>
                          </div>
                        ))}
                        {fin && (
                          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #f1f5f9', fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 12 }}>
                            {fin.omzet_excl   != null && <span>Omzet: <b style={{ color: '#2563eb' }}>{euroFull(fin.omzet_excl)}</b></span>}
                            {fin.transport_cost != null && <span>Transport: <b>{euroFull(fin.transport_cost)}</b></span>}
                            {fin.netto         != null && <span>Netto: <b style={{ color: fin.netto >= 0 ? '#16a34a' : '#dc2626' }}>{euroFull(fin.netto)}</b></span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {prodGroepen.length === 0 && levGroepen.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">💶</div>
              <div className="empty-title">Geen data</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Geen productie of leveringen voor deze periode.</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
