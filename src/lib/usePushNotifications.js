import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

const notifSupported = typeof Notification !== 'undefined'

export function usePushNotifications() {
  const [permission, setPermission] = useState(notifSupported ? Notification.permission : 'default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Check of er al een subscription is
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub)
      })
    })
  }, [])

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notificaties worden niet ondersteund op dit apparaat.\n\nVoeg de app toe aan je beginscherm via Safari.')
      return
    }

    if (!notifSupported) return
    const perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm !== 'granted') return

    try {
      setLoading(true)
      const reg = await navigator.serviceWorker.ready
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const json = sub.toJSON()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        }),
      })

      if (res.ok) setSubscribed(true)
    } catch (err) {
      console.error('Push subscribe fout:', err)
    } finally {
      setLoading(false)
    }
  }

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches)

  const supported = typeof window !== 'undefined' && 'PushManager' in window

  return { permission, subscribed, loading, subscribe, isStandalone, supported }
}
