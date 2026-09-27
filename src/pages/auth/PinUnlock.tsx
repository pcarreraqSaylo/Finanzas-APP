import { useState } from 'react'
import { useAuth } from '../../context/AuthProvider'
import { PinDots, PinKeypad } from '../../components/PinPad'

export function PinUnlock() {
  const { unlock, signOut } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  async function press(digit: string) {
    if (pin.length >= 6) return
    const next = pin + digit
    setPin(next)
    setError(false)
    // A real PIN can be 4, 5, or 6 digits — try as soon as we've reached the
    // shortest valid length, and again with each digit after.
    if (next.length >= 4) {
      const ok = await unlock(next)
      if (!ok && next.length === 6) {
        setError(true)
        setPin('')
      }
    }
  }

  function backspace() {
    setError(false)
    setPin((p) => p.slice(0, -1))
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <span className="font-display text-xl font-semibold text-ink">Ingresa tu PIN</span>
      <PinDots length={Math.max(pin.length, 4)} filled={pin.length} />
      {error && <p className="text-xs text-expense">PIN incorrecto.</p>}
      <PinKeypad onDigit={press} onBackspace={backspace} />
      <button type="button" onClick={signOut} className="text-xs text-ink-soft underline">
        Cerrar sesión
      </button>
    </div>
  )
}
