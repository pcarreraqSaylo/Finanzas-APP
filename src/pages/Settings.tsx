import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { stopRecurringRule, updateRecurringRuleAmount } from '../db/repo'
import type { RecurringRule } from '../db/types'

const CURRENCIES = ['MXN', 'USD', 'EUR']

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

// A raise/pay-cut edited here only ever affects this month forward — see
// updateRecurringRuleAmount in db/repo.ts, which never touches already-logged months.
function RecurringIncomeRow({
  rule,
  categoryName,
  currency,
}: {
  rule: RecurringRule
  categoryName: string
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
        <span className="font-medium">{categoryName}</span>
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
          className="w-28 rounded-app border border-ink/10 bg-surface px-2 py-1.5 text-sm outline-none"
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

export function Settings() {
  const settings = useLiveQuery(() => db.userSettings.get('default'))
  const currency = settings?.currencyDefault ?? 'MXN'

  const recurringIncomes = useLiveQuery(async () => {
    const [rules, categories] = await Promise.all([db.recurringRules.toArray(), db.categories.toArray()])
    const categoryById = new Map(categories.map((c) => [c.id, c]))
    return rules
      .filter((r) => r.type === 'income' && r.active)
      .map((rule) => ({ rule, categoryName: categoryById.get(rule.categoryId)?.name ?? '—' }))
  })

  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [location, setLocation] = useState('')
  const [seeded, setSeeded] = useState(false)

  // settings loads async via useLiveQuery — seed the editable fields once it arrives,
  // then leave the inputs alone so typing isn't fought by a live re-render.
  useEffect(() => {
    if (!seeded && settings) {
      setName(settings.name ?? '')
      setAge(settings.age ? String(settings.age) : '')
      setLocation(settings.location ?? '')
      setSeeded(true)
    }
  }, [seeded, settings])

  async function setCurrency(currency: string) {
    await db.userSettings.update('default', { currencyDefault: currency })
  }

  async function saveProfile() {
    await db.userSettings.update('default', {
      name: name.trim(),
      age: age ? Number(age) : null,
      location: location.trim(),
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-8">
      <h1 className="font-display text-2xl font-semibold">Mi Perfil</h1>

      <div className="flex flex-col gap-3 rounded-app border border-ink/10 bg-surface p-4">
        <div className="text-sm font-medium text-ink-soft">Datos personales</div>
        <input
          type="text"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveProfile}
          className="rounded-app border border-ink/10 bg-pearl px-3 py-2 text-sm outline-none"
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Edad"
          value={age}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '')
            if (raw.length <= 3) setAge(raw)
          }}
          onBlur={saveProfile}
          className="rounded-app border border-ink/10 bg-pearl px-3 py-2 text-sm outline-none"
        />
        <input
          type="text"
          placeholder="Dónde vives"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={saveProfile}
          className="rounded-app border border-ink/10 bg-pearl px-3 py-2 text-sm outline-none"
        />
      </div>

      <div className="rounded-app border border-ink/10 bg-surface p-4">
        <div className="mb-2 text-sm font-medium text-ink-soft">Moneda</div>
        <div className="flex gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={`rounded-app px-3 py-1.5 text-sm ${
                currency === c ? 'bg-teal text-white' : 'bg-pearl text-ink-soft'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-app border border-ink/10 bg-surface p-4">
        <div className="mb-2 text-sm font-medium text-ink-soft">Tema</div>
        <div className="flex gap-2">
          <span className="rounded-app bg-teal px-3 py-1.5 text-sm text-white">Blue</span>
          <span className="rounded-app bg-pearl px-3 py-1.5 text-sm text-ink-soft opacity-60">Green (próximamente)</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-app border border-ink/10 bg-surface p-4">
        <div className="text-sm font-medium text-ink-soft">Ingresos recurrentes</div>
        <p className="text-xs text-ink-soft">
          Un cambio aquí aplica desde este mes en adelante — los meses ya registrados conservan el monto original.
        </p>
        {recurringIncomes?.length === 0 && <p className="text-xs text-ink-soft">Sin ingresos recurrentes activos.</p>}
        <div className="flex flex-col gap-2">
          {recurringIncomes?.map(({ rule, categoryName }) => (
            <RecurringIncomeRow key={rule.id} rule={rule} categoryName={categoryName} currency={currency} />
          ))}
        </div>
      </div>

      <Link to="/categories" className="rounded-app border border-ink/10 bg-surface p-4 text-sm font-medium">
        Gestionar categorías →
      </Link>
    </div>
  )
}
