import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import {
  createRecurringIncome,
  createTransaction,
  deleteTransaction,
  stopRecurringRule,
  updateRecurringRuleAmount,
  type SplitInput,
} from '../db/repo'
import { CategoryBadge } from './CategoryBadge'
import type { RecurringRule } from '../db/types'

type Step = 'closed' | 'category' | 'amount'
type Mode = 'once' | 'recurring'

function formatAmountDisplay(raw: string) {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export function IncomeButton() {
  const [step, setStep] = useState<Step>('closed')
  const [mode, setMode] = useState<Mode>('once')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [whoId, setWhoId] = useState<string | null>(null)
  const [showWho, setShowWho] = useState(false)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dayOfMonth, setDayOfMonth] = useState(() => new Date().getDate())
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [undoTx, setUndoTx] = useState<string | null>(null)

  const categories = useLiveQuery(() => db.categories.where('kind').equals('income').sortBy('sortOrder'))
  const whoOptions = useLiveQuery(() => db.whoOptions.orderBy('sortOrder').toArray())
  const settings = useLiveQuery(() => db.userSettings.get('default'))
  const recurringRules = useLiveQuery(() =>
    db.recurringRules.toArray().then((rules) => rules.filter((r) => r.type === 'income' && r.active)),
  )

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))

  function reset() {
    setStep('closed')
    setMode('once')
    setCategoryId(null)
    setAmount('')
    setWhoId(null)
    setShowWho(false)
    setNote('')
    setDate(new Date().toISOString().slice(0, 10))
    setDayOfMonth(new Date().getDate())
    setEditingRuleId(null)
  }

  function startEditingRule(rule: RecurringRule) {
    setEditingRuleId(rule.id)
    setCategoryId(rule.categoryId)
    setAmount(String(rule.amount))
    setMode('recurring')
    setStep('amount')
  }

  async function save() {
    const value = Number(amount)
    if (!value || value <= 0) return

    if (editingRuleId) {
      await updateRecurringRuleAmount(editingRuleId, value)
      reset()
      return
    }

    if (!categoryId) return

    if (mode === 'recurring') {
      await createRecurringIncome({
        categoryId,
        amount: value,
        currency: settings?.currencyDefault ?? 'MXN',
        dayOfMonth,
        whoId,
        note: note || null,
      })
      reset()
      return
    }

    const splits: SplitInput[] = [{ categoryId, subcategoryId: null, amount: value }]
    const id = await createTransaction({
      date,
      type: 'income',
      currency: settings?.currencyDefault ?? 'MXN',
      note: note || null,
      whoId,
      splits,
    })
    setUndoTx(id)
    reset()
    setTimeout(() => setUndoTx((current) => (current === id ? null : current)), 5000)
  }

  async function stopEditingRule() {
    if (!editingRuleId) return
    await stopRecurringRule(editingRuleId)
    reset()
  }

  async function undo() {
    if (!undoTx) return
    await deleteTransaction(undoTx)
    setUndoTx(null)
  }

  if (step === 'closed') {
    return (
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
        {undoTx && (
          <button type="button" onClick={undo} className="rounded-app bg-ink px-4 py-2 text-sm text-pearl shadow">
            Ingreso guardado
          </button>
        )}
        <button
          type="button"
          onClick={() => setStep('category')}
          className="flex items-center gap-2 rounded-full bg-cornflower px-4 py-3 text-sm font-medium text-white shadow-lg active:scale-95"
        >
          <span className="font-display text-lg leading-none">$</span>
          Agregar Ingresos
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/30" onClick={reset}>
      <div className="w-full max-w-md rounded-t-app bg-surface p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">
            {editingRuleId ? 'Editar ingreso recurrente' : 'Agregar Ingreso'}
          </span>
          <button type="button" onClick={reset} className="text-sm text-ink-soft">
            Cancelar
          </button>
        </div>

        {step === 'category' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('once')}
                className={`flex-1 rounded-app px-3 py-2 text-sm font-medium ${
                  mode === 'once' ? 'bg-cornflower text-white' : 'border border-ink/10 bg-pearl text-ink-soft'
                }`}
              >
                Único
              </button>
              <button
                type="button"
                onClick={() => setMode('recurring')}
                className={`flex-1 rounded-app px-3 py-2 text-sm font-medium ${
                  mode === 'recurring' ? 'bg-cornflower text-white' : 'border border-ink/10 bg-pearl text-ink-soft'
                }`}
              >
                Recurrente (sueldo)
              </button>
            </div>

            {mode === 'recurring' && recurringRules && recurringRules.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-ink-soft">Ingresos recurrentes activos</span>
                {recurringRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-app border border-ink/10 bg-pearl px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <CategoryBadge name={categoryById.get(rule.categoryId)?.name ?? '—'} size="sm" />
                      {categoryById.get(rule.categoryId)?.name} · {formatMoney(rule.amount, rule.currency)}/mes
                    </span>
                    <button
                      type="button"
                      onClick={() => startEditingRule(rule)}
                      className="text-xs font-medium text-cornflower underline"
                    >
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {categories?.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(category.id)
                    setStep('amount')
                  }}
                  className="flex items-center gap-2 rounded-app border border-ink/10 bg-pearl px-3 py-2 text-sm active:scale-95"
                >
                  <CategoryBadge name={category.name} size="sm" />
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'amount' && (
          <div className="flex flex-col gap-4">
            {!editingRuleId && (
              <button type="button" onClick={() => setStep('category')} className="self-start text-sm text-ink-soft">
                ← Cambiar categoría
              </button>
            )}

            <div className="relative">
              <span className="amount-prefix pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-3xl font-semibold text-ink-soft">
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

            {editingRuleId ? (
              <button type="button" onClick={stopEditingRule} className="self-center text-xs text-ink-soft underline">
                Detener este ingreso recurrente
              </button>
            ) : (
              <>
                {mode === 'recurring' ? (
                  <label className="flex items-center justify-between gap-3 rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm">
                    Día del mes
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-16 rounded-app border border-ink/10 bg-pearl px-2 py-1 text-center outline-none"
                    />
                  </label>
                ) : (
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm"
                  />
                )}

                {!showWho && !whoId ? (
                  <button
                    type="button"
                    onClick={() => setShowWho(true)}
                    className="self-center rounded-app bg-cornflower px-3 py-1.5 text-sm text-white active:scale-95"
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
                        className={`rounded-app px-3 py-1.5 text-sm bg-cornflower text-white ${
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
              </>
            )}

            <button
              type="button"
              onClick={save}
              disabled={!amount || Number(amount) <= 0}
              className="rounded-app bg-cornflower px-4 py-3 text-lg font-medium text-white disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
