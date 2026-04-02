import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function LoginPage({ fout = null }) {
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [err, setErr]         = useState(fout)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) { setErr('Fout e-mail of wachtwoord'); setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f2748', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 8 }}>UltiGroup Monitor</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', marginBottom: 40 }}>Inloggen</div>
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email" placeholder="E-mailadres" value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.2)',
            background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 15, outline: 'none' }}
          required
        />
        <input
          type="password" placeholder="Wachtwoord" value={pass}
          onChange={e => setPass(e.target.value)}
          style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.2)',
            background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 15, outline: 'none' }}
          required
        />
        {err && <div style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{err}</div>}
        <button
          type="submit" disabled={loading}
          style={{ padding: 13, borderRadius: 10, background: '#2563eb', border: 'none',
            color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'default' : 'pointer', marginTop: 4 }}>
          {loading ? 'Bezig...' : 'Inloggen'}
        </button>
      </form>
    </div>
  )
}
