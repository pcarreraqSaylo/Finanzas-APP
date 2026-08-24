import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'

export function Trips() {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mergeIntoCategories, setMergeIntoCategories] = useState(false)

  const trips = useLiveQuery(() => db.trips.orderBy('startDate').reverse().toArray())
  const transactions = useLiveQuery(() => db.transactions.toArray())

  const totalsByTrip = new Map<string, number>()
  for (const tx of transactions ?? []) {
    if (!tx.tripId) continue
    if (tx.type !== 'expense') continue
    totalsByTrip.set(tx.tripId, (totalsByTrip.get(tx.tripId) ?? 0) + tx.totalAmount)
  }

  async function createTrip() {
    const trimmed = name.trim()
    if (!trimmed) return
    await db.trips.add({ id: uuid(), name: trimmed, startDate, endDate: null, mergeIntoCategories })
    setName('')
    setMergeIntoCategories(false)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="font-display text-2xl font-semibold">Viajes</h1>

      <div className="flex flex-col gap-2 rounded-app border border-ink/10 bg-surface p-3">
        <input
          type="text"
          placeholder="Nombre del viaje"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-app bg-pearl px-3 py-2 text-sm outline-none"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-app bg-pearl px-3 py-2 text-sm outline-none"
        />
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" checked={mergeIntoCategories} onChange={(e) => setMergeIntoCategories(e.target.checked)} />
          Sumar también a categorías normales (por default queda aislado)
        </label>
        <button type="button" onClick={createTrip} className="rounded-app bg-teal px-4 py-2 text-sm text-white">
          Crear viaje
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {trips?.map((trip) => (
          <div key={trip.id} className="rounded-app border border-ink/10 bg-surface p-3">
            <div className="font-medium">{trip.name}</div>
            <div className="text-xs text-ink-soft">{trip.startDate}</div>
            <div className="mt-1 text-sm font-semibold">
              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(
                totalsByTrip.get(trip.id) ?? 0,
              )}
            </div>
          </div>
        ))}
        {trips?.length === 0 && <p className="text-sm text-ink-soft">Sin viajes todavía.</p>}
      </div>
    </div>
  )
}
