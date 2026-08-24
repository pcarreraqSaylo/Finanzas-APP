import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'

const CURRENCIES = ['MXN', 'USD', 'EUR']

export function Settings() {
  const settings = useLiveQuery(() => db.userSettings.get('default'))

  async function setCurrency(currency: string) {
    await db.userSettings.update('default', { currencyDefault: currency })
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <h1 className="font-display text-2xl font-semibold">Ajustes</h1>

      <div className="rounded-app border border-ink/10 bg-surface p-4">
        <div className="mb-2 text-sm font-medium text-ink-soft">Moneda</div>
        <div className="flex gap-2">
          {CURRENCIES.map((currency) => (
            <button
              key={currency}
              type="button"
              onClick={() => setCurrency(currency)}
              className={`rounded-app px-3 py-1.5 text-sm ${
                settings?.currencyDefault === currency ? 'bg-teal text-white' : 'bg-pearl text-ink-soft'
              }`}
            >
              {currency}
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

      <Link to="/categories" className="rounded-app border border-ink/10 bg-surface p-4 text-sm font-medium">
        Gestionar categorías →
      </Link>
    </div>
  )
}
