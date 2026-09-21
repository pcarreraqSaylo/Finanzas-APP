import { useState } from 'react'
import { useAuth } from '../../context/AuthProvider'

export function LoginEmail() {
  const { sendMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!email.trim()) return
    setSending(true)
    setError(null)
    const { error } = await sendMagicLink(email.trim())
    setSending(false)
    if (error) setError(error)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="font-display text-xl font-semibold text-ink">Revisa tu correo</span>
        <p className="max-w-xs text-sm text-ink-soft">
          Te enviamos un enlace a <span className="font-medium text-ink">{email}</span>. Ábrelo desde este mismo
          dispositivo para entrar.
        </p>
        <button type="button" onClick={() => setSent(false)} className="text-xs font-medium text-ink-soft underline">
          Usar otro correo
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="font-display text-2xl font-semibold text-ink">Finanzas</span>
      <p className="max-w-xs text-sm text-ink-soft">Ingresa tu correo para entrar o crear tu cuenta.</p>
      <input
        type="email"
        inputMode="email"
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="tucorreo@ejemplo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="w-full max-w-xs rounded-app border border-ink/10 bg-surface px-4 py-3 text-center text-sm outline-none"
      />
      {error && <p className="max-w-xs text-xs text-expense">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!email.trim() || sending}
        className="w-full max-w-xs rounded-app bg-teal px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
      >
        {sending ? 'Enviando…' : 'Continuar'}
      </button>
    </div>
  )
}
