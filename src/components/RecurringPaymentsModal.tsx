import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { createRecurringExpense, stopRecurringRule, updateRecurringRuleAmount } from '../db/repo'
import { CategoryBadge } from './CategoryBadge'
import type { RecurringRule, Subcategory } from '../db/types'

type Step = 'list' | 'category' | 'subcategory' | 'details'

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function formatAmountDisplay(raw: string) {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas
}

function clampDayOfMonth(raw: string) {
  return Math.min(31, Math.max(1, Number(raw) || 1))
}

// A raise/pay-cut edited here only ever affects this month forward — see
// updateRecurringRuleAmount in db/repo.ts, which never touches already-logged months.
function RecurringExpenseRow({
  rule,
  label,
  currency,
}: {
  rule: RecurringRule
  label: string
  currency: string
}) {
  const [amount, setAmount] = useState(String(rule.amount))
  const changed = Number(amount) !== rule.amount && !!Number(amount)

  async function save() {
    const value = Number(amount)
    if (!value || value <= 0) return
    await updateRecurringRuleAmount(rule.id, value)
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-app border border-ink/10 bg-pearl p-2.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-ink-soft">Actual: {formatMoney(rule.amount, currency)}/mes</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const raw = e.target.value.replace(/,/g, '')
            if (/^\d*\.?\d*$/.test(raw)) setAmount(raw)
          }}
          className="w-24 rounded-app border border-ink/10 bg-surface px-2 py-1.5 text-sm outline-none"
        />
        <button
          type="button"
          onClick={save}
          disabled={!changed}
          className="rounded-app bg-teal px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Guardar
        </button>
        <button type="button" onClick={() => stopRecurringRule(rule.id)} className="ml-auto text-xs text-expense underline">
          Detener
        </button>
      </div>
    </div>
  )
}

export function RecurringPaymentsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>('list')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [subject, setSubject] = useState('')
  const [whoId, setWhoId] = useState<string | null>(null)
  const [dayOfMonth, setDayOfMonth] = useState(() => String(new Date().getDate()))

  const categories = useLiveQuery(
    () =>
      db.categories
        .where('kind')
        .equals('expense')
        .sortBy('sortOrder')
        .then((cats) => cats.filter((c) => c.name !== 'Siniestros')),
  )
  const subcategories = useLiveQuery<Subcategory[] | undefined>(
    () => (categoryId ? db.subcategories.where('categoryId').equals(categoryId).sortBy('sortOrder') : undefined),
    [categoryId],
  )
  const whoOptions = useLiveQuery(() => db.whoOptions.orderBy('sortOrder').toArray())
  const settings = useLiveQuery(() => db.userSettings.get('default'))

  const rules = useLiveQuery(async () => {
    const [allRules, allCategories, allSubcategories] = await Promise.all([
      db.recurringRules.toArray(),
      db.categories.toArray(),
      db.subcategories.toArray(),
    ])
    const categoryById = new Map(allCategories.map((c) => [c.id, c]))
    const subcategoryById = new Map(allSubcategories.map((s) => [s.id, s]))
    return allRules
      .filter((r) => r.type === 'expense' && r.active)
      .map((rule) => {
        const categoryName = categoryById.get(rule.categoryId)?.name ?? '—'
        const subcategoryName = rule.subcategoryId ? subcategoryById.get(rule.subcategoryId)?.name : null
        const label = rule.note ? `${rule.note} · ${categoryName}` : `${categoryName}${subcategoryName ? ` · ${subcategoryName}` : ''}`
        return { rule, label }
      })
  })

  function reset() {
    setStep('list')
    setCategoryId(null)
    setSubcategoryId(null)
    setAmount('')
    setSubject('')
    setWhoId(null)
    setDayOfMonth(String(new Date().getDate()))
  }

  function close() {
    reset()
    onClose()
  }

  async function save() {
    const value = Number(amount)
    if (!value || value <= 0 || !categoryId || !subject.trim()) return
    await createRecurringExpense({
      categoryId,
      subcategoryId,
      amount: value,
      currency: settings?.currencyDefault ?? 'MXN',
      dayOfMonth: clampDayOfMonth(dayOfMonth),
      whoId,
      note: subject.trim(),
    })
    setStep('list')
    setCategoryId(null)
    setSubcategoryId(null)
    setAmount('')
    setSubject('')
    setWhoId(null)
    setDayOfMonth(String(new Date().getDate()))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/30" onClick={close}>
      <div className="w-full max-w-md rounded-t-app bg-surface p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">
            {step === 'list' ? 'Pagos recurrentes' : 'Nuevo pago recurrente'}
          </span>
          <button type="button" onClick={close} className="text-sm font-medium text-ink">
            Cancelar
          </button>
        </div>

        {step === 'list' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-ink-soft">
              Cargos mensuales fijos (Netflix, teléfono, etc.). Editar el monto aplica desde este mes en adelante — los
              meses ya registrados conservan el monto original.
            </p>
            <div className="flex flex-col gap-2">
              {rules?.length === 0 && <p className="text-sm text-ink-soft">Sin pagos recurrentes todavía.</p>}
              {rules?.map(({ rule, label }) => (
                <RecurringExpenseRow key={rule.id} rule={rule} label={label} currency={rule.currency} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep('category')}
              className="rounded-app border border-dashed border-ink/20 px-4 py-2 text-sm text-ink-soft"
            >
              + Nuevo pago recurrente
            </button>
          </div>
        )}

        {step === 'category' && (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => setStep('list')} className="self-start text-sm text-ink-soft">
              ← Volver
            </button>
            <div className="flex flex-wrap gap-2">
              {categories?.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(category.id)
                    setSubcategoryId(null)
                    setStep('subcategory')
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

        {step === 'subcategory' && (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => setStep('category')} className="self-start text-sm text-ink-soft">
              ← Cambiar categoría
            </button>
            {subcategories && subcategories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setSubcategoryId(sub.id)
                      setStep('details')
                    }}
                    className="rounded-app border border-ink/10 bg-pearl px-3 py-2 text-sm active:scale-95"
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setStep('details')}
              className="rounded-app border border-dashed border-ink/20 px-4 py-2 text-sm text-ink-soft"
            >
              {subcategories && subcategories.length > 0 ? 'Sin subcategoría' : 'Continuar'}
            </button>
          </div>
        )}

        {step === 'details' && (
          <div className="flex flex-col gap-4">
            <button type="button" onClick={() => setStep('subcategory')} className="self-start text-sm text-ink-soft">
              ← Volver
            </button>

            <input
              type="text"
              autoFocus
              placeholder="Nombre (ej. Netflix)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm"
            />

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-3xl font-semibold text-ink-soft">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={formatAmountDisplay(amount)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '')
                  if (/^\d*\.?\d*$/.test(raw)) setAmount(raw)
                }}
                className="w-full rounded-app border border-ink/10 bg-surface px-4 py-3 text-center font-display text-3xl font-semibold outline-none"
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm">
              Día del mes
              <input
                type="text"
                inputMode="numeric"
                value={dayOfMonth}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '')
                  if (raw.length <= 2) setDayOfMonth(raw)
                }}
                onBlur={() => setDayOfMonth(String(clampDayOfMonth(dayOfMonth)))}
                className="w-16 rounded-app border border-ink/10 bg-pearl px-2 py-1 text-center outline-none"
              />
            </label>

            <div className="flex flex-wrap justify-center gap-2">
              {whoOptions?.map((who) => (
                <button
                  key={who.id}
                  type="button"
                  onClick={() => setWhoId(who.id === whoId ? null : who.id)}
                  className={`rounded-app border px-3 py-1.5 text-sm font-medium ${
                    who.id === whoId ? 'border-teal bg-teal text-white' : 'border-ink/10 bg-pearl text-ink-soft'
                  }`}
                >
                  {who.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={save}
              disabled={!amount || Number(amount) <= 0 || !subject.trim()}
              className="rounded-app bg-teal px-4 py-3 text-lg font-medium text-white disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
