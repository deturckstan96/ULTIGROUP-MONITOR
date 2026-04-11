import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const DAG_NAMEN = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const MAAND_NAMEN = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']

// ── Datum helpers ─────────────────────────────────────────────────────────────

function toISO(d) {
  return d.toISOString().slice(0, 10)
}

function isVandaag(iso) {
  return iso === toISO(new Date())
}

function fmtDatum(d) {
  return new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
}

function weekBereik(offset = 0) {
  const d = new Date()
  const day = d.getDay() || 7
  const maandag = new Date(d)
  maandag.setDate(d.getDate() - day + 1 + offset * 7)
  maandag.setHours(0, 0, 0, 0)
  const einde = new Date(maandag)
  einde.setDate(maandag.getDate() + 6)
  einde.setHours(23, 59, 59, 999)
  return { begin: maandag, einde }
}

function maandBereik(year, month) {
  const begin = new Date(year, month, 1)
  begin.setHours(0, 0, 0, 0)
  const einde = new Date(year, month + 1, 0)
  einde.setHours(23, 59, 59, 999)
  return { begin, einde }
}

function weekNr(d) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

// Genereer array van dagen tussen twee datums
function dagenTussen(begin, einde) {
  const dagen = []
  const cur = new Date(begin)
  cur.setHours(12, 0, 0, 0)
  const end = new Date(einde)
  end.setHours(12, 0, 0, 0)
  while (cur <= end) {
    dagen.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dagen
}

function dagNaamVan(d) {
  const idx = (d.getDay() + 6) % 7  // 0=Ma, 6=Zo
  return DAG_NAMEN[idx]
}

// ── Lijnartikelen component ───────────────────────────────────────────────────
function RitLijnen({ lines, loading }) {
  if (loading) return <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Laden…</div>
  if (!lines?.length) return <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Geen lijnartikelen.</div>

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 0',
          borderBottom: i < lines.length - 1 ? '1px solid #f1f5f9' : 'none',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {l.item_name || l.item_id}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 1 }}>
              {l.houtsoort && <span>{l.houtsoort}</span>}
              {l.vocht != null && <span>vocht: {l.vocht}%</span>}
              {l.ispm15 && <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0 5px', borderRadius: 4, fontWeight: 700 }}>ISPM-15</span>}
              {l.lot_key && <span style={{ fontFamily: 'monospace' }}>lot: {l.lot_key}</span>}
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', flexShrink: 0, marginLeft: 8 }}>
            {l.qty_to_receive ?? l.qty_planned ?? '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Rit card (klikbaar, toont inhoud) ────────────────────────────────────────
function RitCard({ rit, richting }) {
  const [expanded, setExpanded] = useState(false)
  const [lines, setLines]       = useState([])
  const [linesLoading, setLinesLoading] = useState(false)

  const isIN = richting === 'IN'
  const partner = isIN ? rit.supplier_name : rit.customer_name
  const isGeladen = rit.status === 'Posted' || rit.status === 'Vertrokken'

  async function toggleExpand() {
    setExpanded(v => !v)
    if (!expanded && lines.length === 0) {
      setLinesLoading(true)
      const tabel = isIN ? 'purch_delivery_line' : 'sales_delivery_line'
      const selectCols = isIN
        ? 'item_id,item_name,qty_to_receive,lot_key,houtsoort,vocht,ispm15'
        : 'item_id,item_name,qty_planned,lot_key'
      const { data, error } = await supabase
        .from(tabel)
        .select(selectCols)
        .eq('delivery_id', rit.delivery_id)
        .order('line_num')
      if (error) console.error('LOverzicht lines error:', error)
      setLines(data || [])
      setLinesLoading(false)
    }
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 10,
      marginBottom: 6,
      borderLeft: `3px solid ${isIN ? '#2563eb' : '#d97706'}`,
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      overflow: 'hidden',
    }}>
      {/* Rit header — klikbaar */}
      <div onClick={toggleExpand} style={{ padding: '10px 12px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
              background: isIN ? '#eff6ff' : '#fffbeb',
              color: isIN ? '#2563eb' : '#d97706',
            }}>
              {isIN ? '↙ IN' : '↗ UIT'}
            </span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{partner || '—'}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: isGeladen ? '#f0fdf4' : '#f8fafc',
              color: isGeladen ? '#16a34a' : '#94a3b8',
            }}>
              {isGeladen ? 'GELADEN' : 'GEPLAND'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 8 }}>
          <span style={{ fontFamily: 'monospace' }}>{rit.delivery_id}</span>
          {rit.tijdslot && <span>· {rit.tijdslot}</span>}
          {rit.transporter_name && <span>· {rit.transporter_name}</span>}
        </div>
      </div>

      {/* Lijnartikelen */}
      {expanded && (
        <div style={{ padding: '0 12px 10px' }}>
          <RitLijnen lines={lines} loading={linesLoading} />
        </div>
      )}
    </div>
  )
}

// ── Hoofd component ───────────────────────────────────────────────────────────
export default function LOverzicht() {
  const now = new Date()

  // Mode: 'week' | 'maand'
  const [mode, setMode]           = useState('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [maandJaar, setMaandJaar] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [datumInput, setDatumInput] = useState('')

  const [inRitten,  setInRitten]  = useState([])
  const [uitRitten, setUitRitten] = useState([])
  const [loading, setLoading]     = useState(true)

  // Bereken bereik op basis van mode
  const bereik = useMemo(() => {
    if (mode === 'week') return weekBereik(weekOffset)
    return maandBereik(maandJaar.year, maandJaar.month)
  }, [mode, weekOffset, maandJaar])

  const beginStr = toISO(bereik.begin)
  const eindeStr = toISO(bereik.einde)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const orFilter = `and(planned_date.gte.${beginStr},planned_date.lte.${eindeStr}),and(delivery_date.gte.${beginStr},delivery_date.lte.${eindeStr})`

      const [inkRes, uitRes] = await Promise.all([
        supabase.from('purch_delivery')
          .select('delivery_id,supplier_name,status,planned_date,delivery_date,tijdslot,transporter_name')
          .or(orFilter),
        supabase.from('sales_delivery')
          .select('delivery_id,customer_name,status,planned_date,delivery_date,tijdslot,transporter_name')
          .or(orFilter),
      ])

      setInRitten(inkRes.data || [])
      setUitRitten(uitRes.data || [])
      setLoading(false)
    }
    load()
  }, [beginStr, eindeStr])

  // Groepeer per dag
  const perDag = useMemo(() => {
    const dagen = dagenTussen(bereik.begin, bereik.einde)
    return dagen.map(dag => {
      const dagISO = toISO(dag)
      const naam   = dagNaamVan(dag)
      const inn    = inRitten.filter(r => (r.planned_date || r.delivery_date)?.startsWith(dagISO))
      const uit    = uitRitten.filter(r => (r.planned_date || r.delivery_date)?.startsWith(dagISO))
      return { dag, dagISO, datumLabel: `${naam} ${fmtDatum(dag)}`, inn, uit, today: isVandaag(dagISO) }
    })
  }, [bereik, inRitten, uitRitten])

  // In maandmodus: verberg lege weekenddagen
  const zichtbareDagen = useMemo(() => {
    if (mode === 'week') return perDag
    return perDag.filter(d => {
      const isWeekend = d.dag.getDay() === 0 || d.dag.getDay() === 6
      return !isWeekend || d.inn.length > 0 || d.uit.length > 0
    })
  }, [mode, perDag])

  const totaalIn  = inRitten.length
  const totaalUit = uitRitten.length

  // Week label
  const wNr = weekNr(bereik.begin)
  const isHuidigeWeek = mode === 'week' && weekOffset === 0
  const isHuidigeMaand = mode === 'maand' && maandJaar.year === now.getFullYear() && maandJaar.month === now.getMonth()

  function navigeerMaand(delta) {
    setMaandJaar(prev => {
      let m = prev.month + delta
      let y = prev.year
      if (m < 0)  { m = 11; y-- }
      if (m > 11) { m = 0;  y++ }
      return { year: y, month: m }
    })
  }

  function maandLabel() {
    return `${MAAND_NAMEN[maandJaar.month]} ${maandJaar.year}`
  }

  function subLabel() {
    if (mode === 'week') return `Week ${wNr} · ${fmtDatum(bereik.begin)} – ${fmtDatum(bereik.einde)}`
    return `${maandLabel()} · ${fmtDatum(bereik.begin)} – ${fmtDatum(bereik.einde)}`
  }

  function springNaarDatum(iso) {
    if (!iso) return
    const d = new Date(iso)
    if (mode === 'week') {
      const vandaag = new Date()
      const diffDays = Math.round((d - vandaag) / 86400000)
      const diffWeeks = Math.round(diffDays / 7)
      setWeekOffset(diffWeeks)
    } else {
      setMaandJaar({ year: d.getFullYear(), month: d.getMonth() })
    }
    setDatumInput('')
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>L-Overzicht</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{subLabel()}</div>
      </div>

      {/* Mode toggle + navigator */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {/* Week / Maand toggle */}
        <button
          onClick={() => setMode('week')}
          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
            background: mode === 'week' ? 'var(--navy)' : '#e2e8f0',
            color: mode === 'week' ? '#fff' : 'var(--text2)' }}
        >
          Week
        </button>
        <button
          onClick={() => setMode('maand')}
          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
            background: mode === 'maand' ? 'var(--navy)' : '#e2e8f0',
            color: mode === 'maand' ? '#fff' : 'var(--text2)' }}
        >
          Maand
        </button>

        {/* Navigator pijlen */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button className="btn-icon" onClick={() => mode === 'week' ? setWeekOffset(v => v - 1) : navigeerMaand(-1)}>←</button>
          {(mode === 'week' ? !isHuidigeWeek : !isHuidigeMaand) && (
            <button className="btn-sm" onClick={() => {
              if (mode === 'week') setWeekOffset(0)
              else setMaandJaar({ year: now.getFullYear(), month: now.getMonth() })
            }}>Nu</button>
          )}
          <button className="btn-icon" onClick={() => mode === 'week' ? setWeekOffset(v => v + 1) : navigeerMaand(1)}>→</button>
        </div>
      </div>

      {/* Datum kiezer */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="date"
          value={datumInput}
          onChange={e => setDatumInput(e.target.value)}
          onBlur={e => springNaarDatum(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && springNaarDatum(datumInput)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', fontSize: 14,
            background: '#fff', color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      {/* KPI summary */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, background: '#eff6ff', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>{loading ? '…' : totaalIn}</div>
          <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>↙ Inkomend</div>
        </div>
        <div style={{ flex: 1, background: '#fffbeb', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{loading ? '…' : totaalUit}</div>
          <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>↗ Uitgaand</div>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Laden…</div>}

      {/* Dag per dag */}
      {!loading && zichtbareDagen.map(({ dag, dagISO, datumLabel, inn, uit, today }) => {
        const heeftRitten = inn.length > 0 || uit.length > 0
        const isWeekend = dag.getDay() === 0 || dag.getDay() === 6

        return (
          <div key={dagISO} style={{ marginBottom: 14, opacity: isWeekend && !heeftRitten ? 0.45 : 1 }}>
            <div style={{
              padding: '6px 10px', borderRadius: 8, marginBottom: 6,
              background: today ? '#fef9c3' : '#f1f5f9',
              borderLeft: today ? '3px solid #fde047' : '3px solid transparent',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: today ? '#92400e' : 'var(--navy)' }}>
                {datumLabel}
              </span>
              {heeftRitten && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {inn.length + uit.length} ritten
                </span>
              )}
            </div>

            {heeftRitten ? (
              <>
                {inn.map(r => <RitCard key={r.delivery_id} rit={r} richting="IN" />)}
                {uit.map(r => <RitCard key={r.delivery_id} rit={r} richting="UIT" />)}
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 10px' }}>Geen ritten</div>
            )}
          </div>
        )
      })}

      {!loading && totaalIn === 0 && totaalUit === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🗓</div>
          <div className="empty-title">Geen ritten</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Geen leveringen gepland {mode === 'week' ? 'deze week' : `in ${maandLabel()}`}.
          </div>
        </div>
      )}
    </div>
  )
}
