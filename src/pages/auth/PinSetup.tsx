import { useState } from 'react'
import { useAuth } from '../../context/AuthProvider'
import { PinDots, PinKeypad } from '../../components/PinPad'

const MAX_LEN = 6
const MIN_LEN = 4

export function PinSetup() {
  const { setupPin } = useAuth()
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  function press(digit: string) {
    setError(null)
    if (stage === 'enter') {
      if (pin.length >= MAX_LEN) return
      const next = pin + digit
      setPin(next)
      if (next.length === MAX_LEN) setStage('confirm')
      return
    }
    if (confirm.length >= pin.length) return
    const next = confirm + digit
    setConfirm(next)
    if (next.length === pin.length) {
      if (next === pin) setupPin(pin)
      else {
        setError('Los PIN no coinciden. Intenta de nuevo.')
        setConfirm('')
      }
    }
  }

  function backspace() {
    setError(null)
    if (stage === 'enter') setPin((p) => p.slice(0, -1))
    else setConfirm((c) => c.slice(0, -1))
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <span className="font-display text-xl font-semibold text-ink">
          {stage === 'enter' ? 'Crea tu PIN' : 'Confirma tu PIN'}
        </span>
        <p className="mt-1 text-sm text-ink-soft">
          {stage === 'enter' ? '4 a 6 dígitos, para abrir la app cada día.' : 'Escríbelo una vez más.'}
        </p>
      </div>
      <PinDots length={stage === 'enter' ? Math.max(pin.length, MIN_LEN) : pin.length} filled={stage === 'enter' ? pin.length : confirm.length} />
      {error && <p className="text-xs text-expense">{error}</p>}
      <PinKeypad onDigit={press} onBackspace={backspace} />
      {stage === 'enter' && pin.length >= MIN_LEN && pin.length < MAX_LEN && (
        <button type="button" onClick={() => setStage('confirm')} className="text-xs font-medium text-teal underline">
          Continuar con {pin.length} dígitos
        </button>
      )}
    </div>
  )
}
