import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function MFAChallenge({ onVerified }) {
  const [code, setCode] = useState('')
  const [fout, setFout] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleVerify(e) {
    e.preventDefault()
    if (code.length !== 6) return
    setBusy(true)
    setFout('')

    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totp = factors?.totp?.[0]
    if (!totp) { setFout('Geen MFA factor gevonden.'); setBusy(false); return }

    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totp.id })
    if (!challenge) { setFout('MFA challenge mislukt.'); setBusy(false); return }

    const { error } = await supabase.auth.mfa.verify({
      factorId: totp.id, challengeId: challenge.id, code,
    })
    setBusy(false)
    if (error) { setFout('Ongeldige code. Probeer opnieuw.'); setCode(''); return }
    onVerified()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f2748', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Verificatie vereist</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 32, textAlign: 'center' }}>
        Voer de 6-cijferige code in van uw authenticator-app.
      </div>
      <form onSubmit={handleVerify} style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456" autoFocus
          style={{ padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,.2)',
            background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 28, fontWeight: 700,
            textAlign: 'center', letterSpacing: 12, outline: 'none' }}
        />
        {fout && <div style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{fout}</div>}
        <button type="submit" disabled={busy || code.length !== 6}
          style={{ padding: 13, borderRadius: 10, background: '#2563eb', border: 'none',
            color: '#fff', fontWeight: 700, fontSize: 15, cursor: busy ? 'default' : 'pointer',
            opacity: (busy || code.length !== 6) ? .5 : 1, marginTop: 4 }}>
          {busy ? 'Verifiëren…' : 'Bevestigen →'}
        </button>
      </form>
      <button onClick={() => supabase.auth.signOut()}
        style={{ marginTop: 24, background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 13 }}>
        Uitloggen
      </button>
    </div>
  )
}
