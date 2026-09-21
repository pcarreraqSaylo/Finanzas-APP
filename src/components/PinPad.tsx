// Shared by PinSetup and PinUnlock — a plain numeric keypad + progress dots, no
// motion (per CONSTITUTION.md: animation stays scoped to the Entry Wheel, not
// added elsewhere in the app).
export function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex gap-3">
      {Array.from({ length }).map((_, i) => (
        <span key={i} className={`h-3 w-3 rounded-full ${i < filled ? 'bg-teal' : 'bg-ink/15'}`} />
      ))}
    </div>
  )
}

export function PinKeypad({ onDigit, onBackspace }: { onDigit: (digit: string) => void; onBackspace: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onDigit(d)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-surface font-display text-xl font-medium text-ink active:scale-95"
        >
          {d}
        </button>
      ))}
      <div />
      <button
        type="button"
        onClick={() => onDigit('0')}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-surface font-display text-xl font-medium text-ink active:scale-95"
      >
        0
      </button>
      <button type="button" onClick={onBackspace} className="flex h-14 w-14 items-center justify-center text-sm text-ink-soft">
        ⌫
      </button>
    </div>
  )
}
