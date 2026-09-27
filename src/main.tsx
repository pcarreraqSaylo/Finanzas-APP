import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { TripModeProvider } from './context/TripMode.tsx'
import { AuthProvider, AUTH_ENABLED } from './context/AuthProvider.tsx'
import { ensureSiniestrosCategory, fixupRenamedSubcategories, seedIfEmpty } from './db/seed.ts'
import { ensureRecurringTransactionsForCurrentMonth } from './db/repo.ts'

// While accounts are enabled, seeding/fixups run per-user inside AuthProvider's
// phase machine instead (it's the one that knows which local database is active).
// While paused (AUTH_ENABLED === false, see AuthProvider.tsx), every device just
// uses the one shared local database directly, same as before accounts existed —
// which means nothing else ever seeds it, so this has to run unconditionally here,
// exactly like it did originally. Forgetting this is exactly what left a brand-new
// device with zero categories after the gate was paused.
if (!AUTH_ENABLED) {
  seedIfEmpty()
    .then(() => fixupRenamedSubcategories())
    .then(() => ensureSiniestrosCategory())
    .then(() => ensureRecurringTransactionsForCurrentMonth())
}

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
