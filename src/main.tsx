import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { TripModeProvider } from './context/TripMode.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'

// Seeding/fixups used to run once here, unconditionally, against a single shared
// database. Now that each logged-in person has their own local database (see
// db/db.ts), that sequencing only makes sense once we know who's logged in — it
// lives in AuthProvider's phase machine instead.

// iOS Safari still allows pinch-zoom via this non-standard gesture event regardless
// of the viewport meta's user-scalable=no — this is the app-should-feel-fixed fix.
document.addEventListener('gesturestart', (e) => e.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TripModeProvider>
          <App />
        </TripModeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
