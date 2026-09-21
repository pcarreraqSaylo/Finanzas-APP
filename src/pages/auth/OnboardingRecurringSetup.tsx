import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/db'
import { createRecurringExpense, createRecurringIncome } from '../../db/repo'
import { useAuth } from '../../context/AuthProvider'
import { CategoryBadge } from '../../components/CategoryBadge'
import type { Kind, Subcategory } from '../../db/types'

function clampDayOfMonth(raw: string) {
  return Math.min(31, Math.max(1, Number(raw) || 1))
}

// One inline add-form, shared by the income and expense sections below — category
// (→ subcategory, expense only) → name/amount/day → save. Same shape as the
// category/subcategory/details steps in RecurringPaymentsModal.tsx, just embedded
// directly on the page instead of a bottom sheet, since this runs full-screen
// during onboarding rather than from a modal trigger.
function AddRecurringForm({ kind, onDone }: { kind: Kind; onDone: () => void }) {
  const [step, setStep] = useState<'category' | 'subcategory' | 'details'>('category')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState(() => String(new Date().getDate()))

  const categories = useLiveQuery(
    () =>
      db.categories
        .where('kind')
        .equals(kind)
        .sortBy('sortOrder')
        .then((cats) => cats.filter((c) => c.name !== 'Siniestros')),
    [kind],
  )
  const subcategories = useLiveQuery<Subcategory[] | undefined>(
    () => (categoryId ? db.subcategories.where('categoryId').equals(categoryId).sortBy('sortOrder') : undefined),
    [categoryId],
  )
  const settings = useLiveQuery(() => db.userSettings.get('default'))

  async function save() {
    const value = Number(amount)
    if (!value || value <= 0 || !categoryId) return
    const currency = settings?.currencyDefault ?? 'MXN'
    const day = clampDayOfMonth(dayOfMonth)
    if (kind === 'income') {
      await createRecurringIncome({ categoryId, amount: value, currency, dayOfMonth: day, note: note || null })
    } else {
      await createRecurringExpense({ categoryId, subcategoryId, amount: value, currency, dayOfMonth: day, note: note || null })
    }
    onDone()
  }

  return (
    <div className="flex flex-col gap-3 rounded-app border border-ink/10 bg-pearl p-3">
      <button type="button" onClick={onDone} className="self-start text-xs text-ink-soft">
        ← Cancelar
      </button>

      {step === 'category' && (
        <div className="flex flex-wrap gap-2">
          {categories?.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                setCategoryId(category.id)
                setStep(kind === 'expense' ? 'subcategory' : 'details')
              }}
              className="flex items-center gap-2 rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm active:scale-95"
            >
              <CategoryBadge name={category.name} size="sm" />
              {category.name}
            </button>
          ))}
        </div>
      )}

      {step === 'subcategory' && (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setStep('category')} className="self-start text-xs text-ink-soft">
            ← Cambiar categoría
          </button>
          {subcategories && subcategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setSubcategoryId(sub.id)
                    setStep('details')
                  }}
                  className="rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm active:scale-95"
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}
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
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setStep(kind === 'expense' ? 'subcategory' : 'category')}
            className="self-start text-xs text-ink-soft"
          >
            ← Volver
          </button>
          <input
            type="text"
            autoFocus
            placeholder={kind === 'income' ? 'Nombre (ej. Sueldo)' : 'Nombre (ej. Renta, Netflix)'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm outline-none"
          />
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-2xl font-semibold text-ink-soft">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, '')
                if (/^\d*\.?\d*$/.test(raw)) setAmount(raw)
              }}
              className="w-full rounded-app border border-ink/10 bg-surface px-4 py-2.5 text-center font-display text-2xl font-semibold outline-none"
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
          <button
            type="button"
            onClick={save}
            disabled={!amount || Number(amount) <= 0}
            className="rounded-app bg-teal px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Agregar
          </button>
        </div>
      )}
    </div>
  )
}

function RecurringSection({ kind, title, addLabel }: { kind: Kind; title: string; addLabel: string }) {
  const [adding, setAdding] = useState(false)
  const settings = useLiveQuery(() => db.userSettings.get('default'))
  const currency = settings?.currencyDefault ?? 'MXN'

  const rules = useLiveQuery(async () => {
    const [allRules, categories] = await Promise.all([db.recurringRules.toArray(), db.categories.toArray()])
    const categoryById = new Map(categories.map((c) => [c.id, c]))
    return allRules
      .filter((r) => r.type === kind && r.active)
      .map((r) => ({ rule: r, name: r.note || categoryById.get(r.categoryId)?.name || '—' }))
  }, [kind])

  function formatMoney(amount: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  }

  return (
    <section className="flex flex-col gap-2 rounded-app border border-ink/10 bg-surface p-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {rules?.map(({ rule, name }) => (
        <div key={rule.id} className="flex items-center justify-between rounded-app bg-pearl px-3 py-2 text-sm">
          <span>{name}</span>
          <span className="font-medium">{formatMoney(rule.amount)}/mes</span>
        </div>
      ))}
      {adding ? (
        <AddRecurringForm kind={kind} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-app border border-dashed border-ink/20 px-4 py-2 text-sm text-ink-soft"
        >
          {addLabel}
        </button>
      )}
    </section>
  )
}

export function OnboardingRecurringSetup() {
  const { finishRecurringOnboarding } = useAuth()

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Antes de empezar</h1>
        <button type="button" onClick={finishRecurringOnboarding} className="text-xs font-medium text-ink-soft underline">
          Hacer esto después
        </button>
      </div>
      <p className="text-sm text-ink-soft">
        Agrega lo que se repite cada mes — tu sueldo y tus cargos fijos — para que ya aparezcan solos de aquí en
        adelante. Puedes hacerlo ahora o después desde Perfil.
      </p>

      <RecurringSection kind="income" title="Ingreso recurrente (sueldo)" addLabel="+ Agregar ingreso" />
      <RecurringSection kind="expense" title="Cargos fijos mensuales" addLabel="+ Agregar cargo recurrente" />

      <button
        type="button"
        onClick={finishRecurringOnboarding}
        className="mt-2 rounded-app bg-teal px-4 py-3 text-sm font-medium text-white"
      >
        Continuar a la app
      </button>
    </div>
  )
}
