import { useState } from 'react'
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

  return (
    <div className="flex min-h-svh justify-center bg-ink/5">
      <div
        className={`flex w-full max-w-md flex-col overflow-x-hidden bg-pearl shadow-xl min-h-svh ${activeTripId ? 'trip-mode' : ''}`}
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
