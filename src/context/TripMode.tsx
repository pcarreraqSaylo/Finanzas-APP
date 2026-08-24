import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface TripModeValue {
  activeTripId: string | null
  startTrip: (tripId: string) => void
  endTrip: () => void
}

const TripModeContext = createContext<TripModeValue | null>(null)
const STORAGE_KEY = 'finanzas.activeTripId'

// Trip Mode is app-wide (dark palette + expense tagging) but only ever toggled
// from the Viajes item in ExtrasMenu — persisted to localStorage so backgrounding
// or reloading the PWA mid-trip doesn't silently drop back to normal mode.
export function TripModeProvider({ children }: { children: ReactNode }) {
  const [activeTripId, setActiveTripId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))

  useEffect(() => {
    if (activeTripId) localStorage.setItem(STORAGE_KEY, activeTripId)
    else localStorage.removeItem(STORAGE_KEY)
  }, [activeTripId])

  return (
    <TripModeContext.Provider
      value={{
        activeTripId,
        startTrip: (tripId) => setActiveTripId(tripId),
        endTrip: () => setActiveTripId(null),
      }}
    >
      {children}
    </TripModeContext.Provider>
  )
}

export function useTripMode() {
  const ctx = useContext(TripModeContext)
  if (!ctx) throw new Error('useTripMode must be used within a TripModeProvider')
  return ctx
}
