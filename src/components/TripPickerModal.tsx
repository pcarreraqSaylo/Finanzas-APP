import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { useTripMode } from '../context/TripMode'

export function TripPickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { startTrip } = useTripMode()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const trips = useLiveQuery(() => db.trips.orderBy('startDate').reverse().toArray())

  function close() {
    setCreating(false)
    setName('')
    onClose()
  }

  function pick(tripId: string) {
    startTrip(tripId)
    close()
  }

  async function createAndStart() {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = uuid()
    await db.trips.add({
      id,
      name: trimmed,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: null,
      mergeIntoCategories: false,
    })
    startTrip(id)
    close()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/30" onClick={close}>
      <div className="w-full max-w-md rounded-t-app bg-surface p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">Elegir viaje</span>
          <button type="button" onClick={close} className="text-sm font-medium text-ink">
            Cancelar
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {trips?.map((trip) => (
            <button
              key={trip.id}
              type="button"
              onClick={() => pick(trip.id)}
              className="rounded-app border border-ink/10 bg-surface-tint px-3 py-2 text-left text-sm active:scale-95"
            >
              <div className="font-medium">{trip.name}</div>
              <div className="text-xs text-ink-soft">{trip.startDate}</div>
            </button>
          ))}
          {trips?.length === 0 && <p className="text-sm text-ink-soft">Sin viajes todavía.</p>}
        </div>

        {creating ? (
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Nombre del viaje"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={createAndStart}
              disabled={!name.trim()}
              className="rounded-app bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Crear y empezar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-3 w-full rounded-app border border-dashed border-ink/20 px-4 py-2 text-sm text-ink-soft"
          >
            + Nuevo viaje
          </button>
        )}
      </div>
    </div>
  )
}
