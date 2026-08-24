import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { createTransaction, deleteTransaction, type SplitInput } from '../db/repo'

function formatAmountDisplay(raw: string) {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas
}

// One-off, out-of-the-ordinary expense (accident, theft, emergency) — same shape
// as a regular expense entry, but reachable only from the Extras menu, never the
// main wheel (see EntryWheel.tsx, which filters the "Siniestros" category out of
// its category ring).
export function SiniestroModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [whoId, setWhoId] = useState<string | null>(null)
  const [showWho, setShowWho] = useState(false)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [undoTx, setUndoTx] = useState<string | null>(null)

  const category = useLiveQuery(() => db.categories.where('name').equals('Siniestros').first())
  const whoOptions = useLiveQuery(() => db.whoOptions.orderBy('sortOrder').toArray())
  const settings = useLiveQuery(() => db.userSettings.get('default'))

  function reset() {
    setAmount('')
    setWhoId(null)
    setShowWho(false)
    setNote('')
    setDate(new Date().toISOString().slice(0, 10))
  }

  function close() {
    reset()
    onClose()
  }

  async function save() {
    const value = Number(amount)
    if (!value || value <= 0 || !category) return
    const splits: SplitInput[] = [{ categoryId: category.id, subcategoryId: null, amount: value }]
    const id = await createTransaction({
      date,
      type: 'expense',
      currency: settings?.currencyDefault ?? 'MXN',
      note: note || null,
      whoId,
      splits,
    })
    setUndoTx(id)
    close()
    setTimeout(() => setUndoTx((current) => (current === id ? null : current)), 5000)
  }

  async function undo() {
    if (!undoTx) return
    await deleteTransaction(undoTx)
    setUndoTx(null)
  }

  if (!open) {
    if (!undoTx) return null
    return (
      <div className="fixed bottom-20 left-1/2 z-20 -translate-x-1/2">
        <button type="button" onClick={undo} className="rounded-app bg-ink px-4 py-2 text-sm text-pearl shadow">
          Siniestro guardado
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/30" onClick={close}>
      <div className="w-full max-w-md rounded-t-app bg-surface p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">Agregar Siniestro</span>
          <button type="button" onClick={close} className="text-sm text-ink-soft">
            Cancelar
          </button>
        </div>
        <p className="mb-3 text-xs text-ink-soft">Gasto único fuera de lo normal — accidente, robo, emergencia.</p>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-3xl font-semibold text-ink-soft">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              placeholder="0"
              value={formatAmountDisplay(amount)}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, '')
                if (/^\d*\.?\d*$/.test(raw)) setAmount(raw)
              }}
              className="w-full rounded-app border border-ink/10 bg-surface px-4 py-3 text-center font-display text-3xl font-semibold outline-none"
            />
          </div>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm"
          />

          {!showWho && !whoId ? (
            <button
              type="button"
              onClick={() => setShowWho(true)}
              className="self-center rounded-app bg-teal px-3 py-1.5 text-sm text-white active:scale-95"
            >
              + Agregar con quién
            </button>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {whoOptions?.map((who) => (
                <button
                  key={who.id}
                  type="button"
                  onClick={() => setWhoId(who.id === whoId ? null : who.id)}
                  className={`rounded-app px-3 py-1.5 text-sm bg-teal text-white ${
                    who.id === whoId ? 'ring-2 ring-white' : 'opacity-80'
                  }`}
                >
                  {who.name}
                </button>
              ))}
            </div>
          )}

          <input
            type="text"
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={save}
            disabled={!amount || Number(amount) <= 0}
            className="rounded-app bg-teal px-4 py-3 text-lg font-medium text-white disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
