import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { updateTransaction } from '../db/repo'
import { CategoryBadge } from './CategoryBadge'
import type { Subcategory, Transaction, WhoOption } from '../db/types'

function formatAmountDisplay(raw: string) {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas
}

export function EditTransactionModal({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const splits = useLiveQuery(
    () => db.transactionSplits.where('transactionId').equals(transaction.id).toArray(),
    [transaction.id],
  )
  const categories = useLiveQuery(
    () => db.categories.where('kind').equals(transaction.type).sortBy('sortOrder'),
    [transaction.type],
  )
  // "Who" only ever applies to expenses — income has no "con quién" dimension.
  const whoOptions = useLiveQuery<WhoOption[] | undefined>(
    () => (transaction.type === 'expense' ? db.whoOptions.orderBy('sortOrder').toArray() : undefined),
    [transaction.type],
  )

  const [date, setDate] = useState(transaction.date)
  const [note, setNote] = useState(transaction.note ?? '')
  const [whoId, setWhoId] = useState(transaction.whoId)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [seeded, setSeeded] = useState(false)

  const isSingleSplit = splits?.length === 1

  // Splits load async via useLiveQuery, so the single-split fields get seeded here
  // once, rather than as useState initializers.
  useEffect(() => {
    if (!seeded && isSingleSplit && splits?.[0]) {
      setCategoryId(splits[0].categoryId)
      setSubcategoryId(splits[0].subcategoryId)
      setAmount(String(splits[0].amount))
      setSeeded(true)
    }
  }, [seeded, isSingleSplit, splits])

  const subcategories = useLiveQuery<Subcategory[] | undefined>(
    () => (categoryId ? db.subcategories.where('categoryId').equals(categoryId).sortBy('sortOrder') : undefined),
    [categoryId],
  )

  async function save() {
    await updateTransaction({
      id: transaction.id,
      date,
      note: note || null,
      whoId: transaction.type === 'expense' ? whoId : null,
      singleSplit:
        isSingleSplit && categoryId && amount ? { categoryId, subcategoryId, amount: Number(amount) } : undefined,
    })
    onClose()
  }

  const canSave = !isSingleSplit || (!!categoryId && !!amount && Number(amount) > 0)

  if (splits === undefined || categories === undefined) return null

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-app bg-surface p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">Editar movimiento</span>
          <button type="button" onClick={onClose} className="text-sm font-medium text-ink">
            Cancelar
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {isSingleSplit ? (
            <>
              <div className="flex flex-wrap gap-2">
                {categories?.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(category.id)
                      setSubcategoryId(null)
                    }}
                    className={`flex items-center gap-2 rounded-app border px-3 py-2 text-sm active:scale-95 ${
                      categoryId === category.id ? 'border-teal bg-teal text-white' : 'border-ink/10 bg-pearl'
                    }`}
                  >
                    <CategoryBadge name={category.name} size="sm" />
                    {category.name}
                  </button>
                ))}
              </div>

              {subcategories && subcategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {subcategories.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSubcategoryId(sub.id === subcategoryId ? null : sub.id)}
                      className={`rounded-app border px-3 py-1.5 text-xs ${
                        subcategoryId === sub.id ? 'border-teal bg-teal text-white' : 'border-ink/10 bg-pearl'
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <span className="amount-prefix pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-2xl font-semibold text-ink-soft">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatAmountDisplay(amount)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '')
                    if (/^\d*\.?\d*$/.test(raw)) setAmount(raw)
                  }}
                  className="w-full rounded-app border border-ink/10 bg-pearl px-4 py-3 text-center font-display text-2xl font-semibold outline-none"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1 rounded-app border border-ink/10 bg-pearl p-3 text-xs text-ink-soft">
              <span className="font-medium text-ink">Este movimiento tiene varias categorías (split).</span>
              <span>La división entre categorías no es editable desde aquí todavía — solo fecha, nota y quién.</span>
            </div>
          )}

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-app border border-ink/10 bg-pearl px-3 py-2 text-sm"
          />

          {transaction.type === 'expense' && (
            <div className="flex flex-wrap gap-2">
              {whoOptions?.map((who) => (
                <button
                  key={who.id}
                  type="button"
                  onClick={() => setWhoId(who.id === whoId ? null : who.id)}
                  className={`rounded-app px-3 py-1.5 text-sm ${
                    who.id === whoId ? 'bg-teal text-white ring-2 ring-white' : 'bg-pearl text-ink-soft'
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
            className="rounded-app border border-ink/10 bg-pearl px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="rounded-app bg-teal px-4 py-3 text-lg font-medium text-white disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
