import { useState } from 'react'
import { useAuth } from '../../context/AuthProvider'

export function ClaimDataChoice() {
  const { claim } = useAuth()
  const [loading, setLoading] = useState<'claim' | 'fresh' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(choice: 'claim' | 'fresh') {
    setLoading(choice)
    setError(null)
    try {
      await claim(choice)
    } catch {
      setError('Algo salió mal moviendo tus datos. Intenta de nuevo.')
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="font-display text-xl font-semibold text-ink">Encontramos datos en este dispositivo</span>
      <p className="max-w-xs text-sm text-ink-soft">
        Hay movimientos guardados de antes de tener cuentas. ¿Quieres que sean tuyos, o prefieres empezar desde cero?
      </p>
      {error && <p className="max-w-xs text-xs text-expense">{error}</p>}
      <button
        type="button"
        onClick={() => pick('claim')}
        disabled={loading !== null}
        className="w-full max-w-xs rounded-app bg-teal px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
      >
        {loading === 'claim' ? 'Moviendo tus datos…' : 'Sí, son míos'}
      </button>
      <button
        type="button"
        onClick={() => pick('fresh')}
        disabled={loading !== null}
        className="w-full max-w-xs rounded-app border border-ink/10 bg-surface px-4 py-3 text-sm font-medium text-ink-soft disabled:opacity-40"
      >
        {loading === 'fresh' ? 'Preparando…' : 'No, empezar de cero'}
      </button>
    </div>
  )
}
