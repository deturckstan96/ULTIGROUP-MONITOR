import { useState, useCallback, useEffect } from 'react'
import './index.css'
import { supabase } from './lib/supabase.js'
import LoginPage from './components/LoginPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Feed from './pages/Feed.jsx'
import Stock from './pages/Stock.jsx'
import LOverzicht from './pages/LOverzicht.jsx'
import Sjaka from './pages/Sjaka.jsx'
import PullToRefresh from './components/PullToRefresh.jsx'
import NotificationCenter from './components/NotificationCenter.jsx'
import { usePushNotifications } from './lib/usePushNotifications.js'

const TABS = [
  { id: 'dashboard',  icon: '📊', label: 'Overzicht'  },
  { id: 'feed',       icon: '📋', label: 'Activiteit' },
  { id: 'stock',      icon: '📦', label: 'Stock'      },
  { id: 'loverzicht', icon: '🗓', label: 'L-Overzicht'},
  { id: 'sjaka',      icon: '💶', label: 'Sjaka'      },
]

export default function App({ initialSession = null }) {
  const [session, setSession]       = useState(initialSession)
  const [authLoading, setAuthLoading] = useState(false)
  const [accessFout, setAccessFout] = useState(null)
  const [tab, setTab]               = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const [notifOpen, setNotifOpen]   = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { permission, subscribed, loading, subscribe, isStandalone, supported } = usePushNotifications()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (_e === 'SIGNED_IN' && s) {
        const email = s.user?.email
        if (email !== 'stan@ultigroup.be') {
          setAccessFout('Dit account heeft geen toegang tot de Monitor app.')
          setSession(null)
          setAuthLoading(false)
          supabase.auth.signOut()
          return
        }
        setAccessFout(null)
      }
      setSession(s)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (authLoading) return <div style={{ position: 'fixed', inset: 0, background: '#0f2748' }} />
  if (!session)    return <LoginPage fout={accessFout} />

  const showInstallHint = !isStandalone
  const showPushBanner  = isStandalone && supported && permission !== 'granted' && !subscribed

  const handleRefresh = useCallback(() => {
    return new Promise(resolve => {
      setRefreshKey(k => k + 1)
      setTimeout(resolve, 600)
    })
  }, [])

  return (
    <>
      {/* ── Header ── */}
      <div className="app-header">
        <div>
          <div className="app-header-title">UltiGroup Monitor</div>
          <div className="app-header-sub">Werkvloer overzicht</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 18, opacity: 0.45 }}
            title="Uitloggen"
          >🔒</button>
          <button
            onClick={() => setNotifOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: 4 }}
          >
            <span style={{ fontSize: 20, opacity: subscribed ? 1 : 0.6 }}>🔔</span>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: 0,
                background: '#ef4444', color: '#fff',
                borderRadius: '999px', fontSize: 10, fontWeight: 800,
                minWidth: 16, height: 16, lineHeight: '16px',
                textAlign: 'center', padding: '0 3px',
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Banners ── */}
      {showInstallHint && tab === 'dashboard' && (
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div className="install-prompt">
            <strong>Installeer als app:</strong> Tik op Deel → "Voeg toe aan beginscherm" om notificaties te ontvangen.
          </div>
        </div>
      )}
      {showPushBanner && (
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div className="push-banner">
            <div style={{ flex: 1, fontSize: 13, color: '#1e40af' }}>
              <strong>Ontvang meldingen</strong> bij afmeldingen, productie en stock alerts.
            </div>
            <button className="push-banner-btn" onClick={subscribe} disabled={loading}>
              {loading ? '…' : 'Inschakelen'}
            </button>
          </div>
        </div>
      )}

      {/* ── Content met pull-to-refresh ── */}
      <PullToRefresh onRefresh={handleRefresh}>
        {tab === 'dashboard'  && <Dashboard  key={refreshKey} />}
        {tab === 'feed'       && <Feed       key={refreshKey} />}
        {tab === 'stock'      && <Stock      key={refreshKey} />}
        {tab === 'loverzicht' && <LOverzicht key={refreshKey} />}
        {tab === 'sjaka'      && <Sjaka      key={refreshKey} />}
      </PullToRefresh>

      {/* ── Notificatiecentrum ── */}
      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onUnreadChange={setUnreadCount}
      />

      {/* ── Tab bar ── */}
      <nav className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  )
}
