import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { useTripMode } from '../context/TripMode'
import { SiniestroModal } from './SiniestroModal'
import { TripPickerModal } from './TripPickerModal'

export function ExtrasMenu() {
  const [open, setOpen] = useState(false)
  const [siniestroOpen, setSiniestroOpen] = useState(false)
  const [tripPickerOpen, setTripPickerOpen] = useState(false)

  const { activeTripId, endTrip } = useTripMode()
  const activeTrip = useLiveQuery(
    () => (activeTripId ? db.trips.get(activeTripId) : undefined),
    [activeTripId],
  )

  // Tapping Viajes toggles: no active trip → open the picker to start one;
  // already in a trip → tapping it again is how you "log out" of Trip Mode.
  function handleViajes() {
    setOpen(false)
    if (activeTripId) endTrip()
    else setTripPickerOpen(true)
  }

  const items = [
    {
      key: 'viajes',
      label: activeTrip ? `Viajes: ${activeTrip.name}` : 'Viajes',
      icon: '/icons/viajes.png',
      active: Boolean(activeTripId),
      onClick: handleViajes,
    },
    {
      key: 'siniestros',
      label: 'Siniestros',
      icon: null,
      active: false,
      onClick: () => {
        setOpen(false)
        setSiniestroOpen(true)
      },
    },
    {
      key: 'categoria',
      label: 'Agregar categoría',
      icon: '/icons/administrativo.png',
      active: false,
      to: '/categories',
    },
  ]

  return (
    <>
      <div className="absolute bottom-4 left-4 flex flex-col-reverse items-start gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Extras"
          className="wheel-button flex h-14 w-14 items-center justify-center rounded-full bg-baby-blue font-display text-2xl font-bold text-ink active:scale-95"
        >
          {open ? '×' : '+'}
        </button>

        {open &&
          items.map((item, i) => {
            const content = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-tint ring-1 ring-ink/10">
                  {item.icon ? (
                    <img src={item.icon} alt="" className="h-6 w-6 object-contain" />
                  ) : (
                    <span className="font-display text-sm font-semibold text-ink-soft">?</span>
                  )}
                </span>
                <span className={`text-sm font-medium ${item.active ? 'text-white' : 'text-ink'}`}>{item.label}</span>
              </>
            )

            const className = `animate-ring-pop flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 shadow-md ring-1 active:scale-95 ${
              item.active ? 'bg-teal ring-teal text-white' : 'bg-surface ring-ink/10'
            }`
            const style = { animationDelay: `${i * 45}ms` }

            if (item.to) {
              return (
                <Link key={item.key} to={item.to} onClick={() => setOpen(false)} className={className} style={style}>
                  {content}
                </Link>
              )
            }
            return (
              <button key={item.key} type="button" onClick={item.onClick} className={className} style={style}>
                {content}
              </button>
            )
          })}
      </div>

      <SiniestroModal open={siniestroOpen} onClose={() => setSiniestroOpen(false)} />
      <TripPickerModal open={tripPickerOpen} onClose={() => setTripPickerOpen(false)} />
    </>
  )
}
