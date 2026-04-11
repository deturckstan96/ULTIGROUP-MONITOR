import { createRoot } from 'react-dom/client'
import { supabase } from './lib/supabase.js'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registratie mislukt:', err)
    })
  })
}

// Wacht op sessie VOOR mount — voorkomt render-phase setState conflict (#310)
supabase.auth.getSession()
  .then(({ data }) => {
    createRoot(document.getElementById('root')).render(
      <App initialSession={data.session} />
    )
  })
  .catch(() => {
    // getSession faalt → mount zonder sessie (toont loginpagina)
    createRoot(document.getElementById('root')).render(
      <App initialSession={null} />
    )
  })
