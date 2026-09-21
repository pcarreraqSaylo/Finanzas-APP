import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { SwipeableTabs } from './components/SwipeableTabs'
import { Trips } from './pages/Trips'
import { useTripMode } from './context/TripMode'

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
        {isTrips ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Trips />
          </div>
        ) : (
          <SwipeableTabs homeResetKey={homeResetKey} />
        )}
        <BottomNav onHomeClick={() => setHomeResetKey((k) => k + 1)} />
      </div>
    </div>
  )
}

export default App
