import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { SwipeableTabs } from './components/SwipeableTabs'
import { Trips } from './pages/Trips'
import { useTripMode } from './context/TripMode'
import { useAuth } from './context/AuthProvider'
import { LoginEmail } from './pages/auth/LoginEmail'
import { ClaimDataChoice } from './pages/auth/ClaimDataChoice'
import { PinSetup } from './pages/auth/PinSetup'
import { PinUnlock } from './pages/auth/PinUnlock'
import { OnboardingRecurringSetup } from './pages/auth/OnboardingRecurringSetup'

// Trips lives outside the swipeable bottom-tab sequence (it's reached via the Extras
// menu, not a bottom-nav tab), so it renders as a plain page instead of a swipe panel.
function App() {
  const location = useLocation()
  const isTrips = location.pathname === '/trips'
  // Tapping Home while already on '/' is not a route change, so nothing would otherwise
  // tell the wheel to reset — this counter is bumped on every Home tap and Home/EntryWheel
  // watch it to snap back to the closed wheel regardless of where they currently are.
  const [homeResetKey, setHomeResetKey] = useState(0)
  const { activeTripId } = useTripMode()
  const { phase } = useAuth()

  // Any phase other than "unlocked" replaces the whole app with a gate screen —
  // this is what makes switching db/db.ts's `db` binding to a different person's
  // local database safe: the tree that actually reads `db` (SwipeableTabs and
  // everything under it) is fully unmounted before that switch and only remounts
  // once AuthProvider has already resolved which database it should read.
  let gate: ReactNode = null
  if (phase === 'loading') gate = <div className="flex flex-1 items-center justify-center text-sm text-ink-soft">Cargando…</div>
  else if (phase === 'signedOut') gate = <LoginEmail />
  else if (phase === 'claimChoice') gate = <ClaimDataChoice />
  else if (phase === 'needsPin') gate = <PinSetup />
  else if (phase === 'needsRecurringOnboarding') gate = <OnboardingRecurringSetup />
  else if (phase === 'locked') gate = <PinUnlock />

  // The iPhone status bar takes its color from <meta name="theme-color">, which is
  // static in index.html — without this it stayed teal (Home's color) on every page,
  // clashing with the pearl background everywhere else. Home keeps teal (KpiStrip's
  // own background); Trips matches whatever the app shell is currently showing there
  // (dark once Trip Mode is on); everything else matches the app shell's pearl.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return
    const isHome = location.pathname === '/'
    const color = isHome ? '#008080' : isTrips && activeTripId ? '#14181a' : '#f5f2e8'
    meta.setAttribute('content', color)
  }, [location.pathname, isTrips, activeTripId])

  return (
    <div className="flex h-full justify-center overflow-hidden bg-ink/5">
      <div
        className={`flex h-full w-full max-w-md flex-col overflow-hidden bg-pearl shadow-xl ${activeTripId ? 'trip-mode' : ''}`}
      >
        {gate ? (
          gate
        ) : isTrips ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Trips />
          </div>
        ) : (
          <SwipeableTabs homeResetKey={homeResetKey} />
        )}
        {!gate && <BottomNav onHomeClick={() => setHomeResetKey((k) => k + 1)} />}
      </div>
    </div>
  )
}

export default App
