import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { TripModeProvider } from './context/TripMode.tsx'
import { ensureSiniestrosCategory, fixupRenamedSubcategories, seedIfEmpty } from './db/seed.ts'
import { ensureRecurringTransactionsForCurrentMonth } from './db/repo.ts'

seedIfEmpty()
  .then(() => fixupRenamedSubcategories())
  .then(() => ensureSiniestrosCategory())
  .then(() => ensureRecurringTransactionsForCurrentMonth())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TripModeProvider>
        <App />
      </TripModeProvider>
    </BrowserRouter>
  </StrictMode>,
)
