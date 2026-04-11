import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Stock() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [zoek, setZoek] = useState('')
  const [sorteer, setSorteer] = useState('kritiek')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('vw_stock_alle_artikelen')
        .select('item_id, item_name, type, qty_totaal, minstock, klant_naam')
        .gt('minstock', 0)

      // Aggregeer per item_id (meerdere locaties samentellen)
      const map = {}
      for (const s of data || []) {
        if (!map[s.item_id]) {
          map[s.item_id] = { nr: s.item_id, naam: s.item_name, type: s.type, klant_naam: s.klant_naam, min_stock: Number(s.minstock) || 0, qty: 0 }
        }
        map[s.item_id].qty += Number(s.qty_totaal) || 0
      }

      const result = []
      for (const item of Object.values(map)) {
        const qty = item.qty
        const min = item.min_stock
        if (min <= 0) continue
        const pct = Math.min(100, Math.round(qty / min * 100))
        let status = 'ok'
        if (qty < min * 0.5) status = 'rood'
        else if (qty < min) status = 'oranje'
        result.push({ ...item, qty, pct, status })
      }

      // Sorteren: rood eerst, dan oranje, dan ok
      result.sort((a, b) => {
        const order = { rood: 0, oranje: 1, ok: 2 }
        return order[a.status] - order[b.status]
      })

      setItems(result)
      setLoading(false)
    }

    load()
    const interval = setInterval(load, 120_000)
    return () => clearInterval(interval)
  }, [])

  const roodCount   = items.filter(i => i.status === 'rood').length
  const oranjeCount = items.filter(i => i.status === 'oranje').length

  const zichtbaar = items
    .filter(i => !zoek || i.naam.toLowerCase().includes(zoek.toLowerCase()) || i.nr.toLowerCase().includes(zoek.toLowerCase()) || (i.klant_naam && i.klant_naam.toLowerCase().includes(zoek.toLowerCase())))
    .sort((a, b) => {
      if (sorteer === 'az') return a.naam.localeCompare(b.naam)
      if (sorteer === 'laag') return a.pct - b.pct
      return ({ rood: 0, oranje: 1, ok: 2 }[a.status] - { rood: 0, oranje: 1, ok: 2 }[b.status])
    })

  const sortBtn = (key, label) => (
    <button
      onClick={() => setSorteer(key)}
      style={{
        padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        background: sorteer === key ? 'var(--navy)' : '#e2e8f0',
        color: sorteer === key ? '#fff' : 'var(--text2)',
      }}
    >{label}</button>
  )

  return (
    <div className="page">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>Stockbeheer</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Artikelen met minimumlimiet</div>
      </div>

      {/* Zoekbalk */}
      <input
        type="search"
        placeholder="Zoek pallet…"
        value={zoek}
        onChange={e => setZoek(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
          border: '1.5px solid #e2e8f0', fontSize: 14, marginBottom: 10, outline: 'none',
          background: '#f8fafc',
        }}
      />

      {/* Sorteerknoppen */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {sortBtn('kritiek', '🔴 Kritiek')}
        {sortBtn('laag', '📉 Laag → Hoog')}
        {sortBtn('az', 'A – Z')}
      </div>

      {/* Samenvatting badges */}
      {!loading && (roodCount > 0 || oranjeCount > 0) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {roodCount > 0 && (
            <div style={{ background: '#fee2e2', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
              🔴 {roodCount} kritiek laag
            </div>
          )}
          {oranjeCount > 0 && (
            <div style={{ background: '#fffbeb', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#d97706' }}>
              🟡 {oranjeCount} onder minimum
            </div>
          )}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Laden…</div>}

      {!loading && zichtbaar.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <div className="empty-title">{zoek ? 'Geen resultaten' : 'Geen artikelen'}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{zoek ? `Geen pallet gevonden voor "${zoek}".` : 'Geen artikelen met minimumlimiet gevonden.'}</div>
        </div>
      )}

      {zichtbaar.map(item => {
        const kleur    = item.status === 'rood' ? '#dc2626' : item.status === 'oranje' ? '#d97706' : '#16a34a'
        const bg       = item.status === 'rood' ? '#fee2e2' : item.status === 'oranje' ? '#fffbeb' : '#f0fdf4'
        const barKleur = item.status === 'rood' ? '#dc2626' : item.status === 'oranje' ? '#f59e0b' : '#22c55e'
        return (
          <div key={item.nr} className="card card-body" style={{ marginBottom: 8, borderLeft: `3px solid ${kleur}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{item.naam}</div>
                {item.klant_naam && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.klant_naam}</div>}
              </div>
              <div style={{ background: bg, color: kleur, borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                {item.qty} / {item.min_stock}
              </div>
            </div>
            {/* Voortgangsbalk */}
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${item.pct}%`, background: barKleur, borderRadius: 99, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              {item.pct}% van minimum{item.status !== 'ok' ? ` — tekort: ${item.min_stock - item.qty}` : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
