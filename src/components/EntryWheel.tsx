import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import type { Kind, Subcategory } from '../db/types'
import { createTransaction, deleteTransaction, type SplitInput } from '../db/repo'
import { CategoryBadge } from './CategoryBadge'
import { useTripMode } from '../context/TripMode'

// Income entry via the wheel is deferred — every entry defaults to 'expense' for now.
const CENTER_BUTTON_SIZE = 124 // the "+" / "×" / category-badge center button
const RING_1_RADIUS = 110 // category ring — closest to center, far enough out to clear the center button
const RING_2_RADIUS = 154 // subcategory ring — appears further out, same track style
const CATEGORY_BUTTON_SIZE = 73
const SUBCATEGORY_BUTTON_SIZE = 62
const CATEGORY_BASELINE_COUNT = 7 // the seeded expense category count — no shrinking up to here
const CATEGORY_SHRINK_PER_EXTRA = 2.5 // px off the diameter for every category past the baseline
const CATEGORY_MIN_BUTTON_SIZE = 46 // floor so the badge inside (40px) never overflows the button

function categoryButtonSize(count: number) {
  const extra = Math.max(0, count - CATEGORY_BASELINE_COUNT)
  return Math.max(CATEGORY_MIN_BUTTON_SIZE, CATEGORY_BUTTON_SIZE - extra * CATEGORY_SHRINK_PER_EXTRA)
}
const WHEEL_SIZE = RING_2_RADIUS * 2 + 90 // fixed container so the wheel doesn't reflow between steps
const SIBLING_EXIT_DURATION_MS = 360 // must match the .animate-ring-exit CSS duration

function formatAmountDisplay(raw: string) {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas
}

type Step = 'closed' | 'category' | 'subcategory' | 'amount'

interface RingItem {
  id: string
  label: string
}

// All radii/sizes below are "design pixels" against WHEEL_SIZE, then converted to
// percentages of the wheel container — so the whole wheel scales down to fit narrow
// phones instead of overflowing (percentages resolve against the container's own
// box, which itself is capped at min(WHEEL_SIZE, 100% of available width)).
function pct(designPx: number) {
  return (designPx / WHEEL_SIZE) * 100
}

function RingLayout({
  items,
  onPick,
  radius,
  buttonSize,
  badgeSize,
  exitingId,
  trailingAction,
}: {
  items: RingItem[]
  onPick: (id: string) => void
  radius: number
  buttonSize: number
  badgeSize: 'sm' | 'md'
  exitingId?: string | null
  trailingAction?: { label: string; onClick: () => void }
}) {
  const totalSlots = items.length + (trailingAction ? 1 : 0)

  const positioned = useMemo(() => {
    return items.map((item, i) => {
      const angle = (2 * Math.PI * i) / totalSlots - Math.PI / 2
      const x = radius * Math.cos(angle)
      const y = radius * Math.sin(angle)
      return { ...item, x, y, i }
    })
  }, [items, radius, totalSlots])

  const trailingPos = useMemo(() => {
    if (!trailingAction) return null
    const angle = (2 * Math.PI * items.length) / totalSlots - Math.PI / 2
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
  }, [trailingAction, items.length, totalSlots, radius])

  const isExiting = exitingId !== undefined && exitingId !== null

  return (
    <>
      {positioned.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item.id)}
          className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full bg-surface p-1 text-center ring-1 ring-ink/10 active:scale-95 ${
            isExiting ? (item.id === exitingId ? 'animate-ring-dissolve' : 'animate-ring-exit') : 'animate-ring-pop'
          }`}
          style={{
            left: `${50 + pct(item.x)}%`,
            top: `${50 + pct(item.y)}%`,
            width: `${pct(buttonSize)}%`,
            height: `${pct(buttonSize)}%`,
            animationDelay: isExiting ? '0ms' : `${item.i * 45}ms`,
          }}
        >
          <CategoryBadge name={item.label} size={badgeSize} />
          <span className="text-[10px] leading-tight text-ink-soft">{item.label}</span>
        </button>
      ))}

      {trailingAction && trailingPos && !isExiting && (
        <button
          type="button"
          onClick={trailingAction.onClick}
          className="animate-ring-pop absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full bg-teal text-center text-white active:scale-95"
          style={{
            left: `${50 + pct(trailingPos.x)}%`,
            top: `${50 + pct(trailingPos.y)}%`,
            width: `${pct(buttonSize)}%`,
            height: `${pct(buttonSize)}%`,
            animationDelay: `${items.length * 45}ms`,
          }}
        >
          <span className="text-xl leading-none">+</span>
          <span className="text-[10px] leading-tight">{trailingAction.label}</span>
        </button>
      )}
    </>
  )
}

function ringTrackStyle(radius: number, thickness: number): CSSProperties {
  return {
    width: `${pct(radius * 2)}%`,
    height: `${pct(radius * 2)}%`,
    left: `${50 - pct(radius)}%`,
    top: `${50 - pct(radius)}%`,
    borderWidth: thickness,
  }
}

export function EntryWheel({
  resetKey,
  onOpenChange,
}: {
  resetKey?: number
  onOpenChange?: (open: boolean) => void
}) {
  const [step, setStep] = useState<Step>('closed')
  const [kind] = useState<Kind>('expense')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [whoId, setWhoId] = useState<string | null>(null)
  const [showWho, setShowWho] = useState(false)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [undoTx, setUndoTx] = useState<string | null>(null)
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null)
  const pendingRef = useRef<string | null>(null)
  const [addingSubcategory, setAddingSubcategory] = useState(false)
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [pendingSubcategoryId, setPendingSubcategoryId] = useState<string | null>(null)
  const pendingSubRef = useRef<string | null>(null)

  const { activeTripId } = useTripMode()

  // Siniestros is a real expense category (so it rolls up in Analytics/Transactions
  // like any other) but it's only ever loggable via the Extras menu — never shown
  // in the main wheel's category ring. See db/seed.ts's ensureSiniestrosCategory.
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
  const whoOptions = useLiveQuery(() => db.whoOptions.orderBy('sortOrder').toArray())
  const settings = useLiveQuery(() => db.userSettings.get('default'))

  const selectedCategoryIndex = categories?.findIndex((c) => c.id === categoryId) ?? -1
  const selectedCategory = selectedCategoryIndex >= 0 ? categories![selectedCategoryIndex] : null

  const pendingCategoryIndex = categories?.findIndex((c) => c.id === pendingCategoryId) ?? -1
  const pendingCategory = pendingCategoryIndex >= 0 ? categories![pendingCategoryIndex] : null

  function reset() {
    pendingRef.current = null
    setPendingCategoryId(null)
    pendingSubRef.current = null
    setPendingSubcategoryId(null)
    setStep('closed')
    setCategoryId(null)
    setSubcategoryId(null)
    setAmount('')
    setWhoId(null)
    setShowWho(false)
    setNote('')
    setDate(new Date().toISOString().slice(0, 10))
    setAddingSubcategory(false)
    setNewSubcategoryName('')
  }

  useEffect(() => {
    // Tapping the Home nav tab while already on '/' isn't a route change, so nothing
    // else would tell the wheel to snap back — this fires on every Home tap regardless
    // of what step the wheel is currently on (mid-amount-entry included).
    if (resetKey !== undefined) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  async function createAndSelectSubcategory() {
    const name = newSubcategoryName.trim()
    if (!name || !categoryId) return
    const count = await db.subcategories.where('categoryId').equals(categoryId).count()
    const id = uuid()
    await db.subcategories.add({ id, categoryId, name, icon: null, sortOrder: count })
    setSubcategoryId(id)
    setStep('amount')
    setAddingSubcategory(false)
    setNewSubcategoryName('')
  }

  function pickCategory(id: string) {
    pendingRef.current = id
    setPendingCategoryId(id)
    // Wait for the exit animation to finish (all bubbles exit together, in sync) before
    // the subcategory ring appears — the two should never overlap.
    setTimeout(() => {
      if (pendingRef.current !== id) return
      setCategoryId(id)
      setStep('subcategory')
      setPendingCategoryId(null)
      pendingRef.current = null
    }, SIBLING_EXIT_DURATION_MS)
  }

  function pickSubcategory(id: string) {
    pendingSubRef.current = id
    setPendingSubcategoryId(id)
    // Same idea as pickCategory — let the exit animation finish before the amount panel
    // fades in, so the two never overlap.
    setTimeout(() => {
      if (pendingSubRef.current !== id) return
      setSubcategoryId(id)
      setStep('amount')
      setPendingSubcategoryId(null)
      pendingSubRef.current = null
    }, SIBLING_EXIT_DURATION_MS)
  }

  useEffect(() => {
    if (step === 'subcategory' && subcategories && subcategories.length === 0) {
      setSubcategoryId(null)
      setStep('amount')
    }
  }, [step, subcategories])

  useEffect(() => {
    onOpenChange?.(step !== 'closed')
    // onOpenChange is a setter from the parent — stable across renders, but excluding it
    // from deps avoids re-firing this on every parent re-render for a value that only
    // actually needs to change when `step` does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  async function save() {
    const value = Number(amount)
    if (!value || value <= 0 || !categoryId) return
    const splits: SplitInput[] = [{ categoryId, subcategoryId, amount: value }]
    const id = await createTransaction({
      date,
      type: kind,
      currency: settings?.currencyDefault ?? 'MXN',
      note: note || null,
      whoId,
      tripId: activeTripId,
      splits,
    })
    setUndoTx(id)
    // Land back on this category's subcategory ring (not the empty wheel) — logging a
    // second item in the same place shouldn't mean re-picking the category from scratch.
    // If the category has no subcategories, the effect above bounces this straight back
    // to a fresh 'amount' step for the same category instead.
    setSubcategoryId(null)
    setAmount('')
    setWhoId(null)
    setShowWho(false)
    setNote('')
    setDate(new Date().toISOString().slice(0, 10))
    setStep('subcategory')
    setTimeout(() => setUndoTx((current) => (current === id ? null : current)), 5000)
  }

  async function undo() {
    if (!undoTx) return
    await deleteTransaction(undoTx)
    setUndoTx(null)
  }

  return (
    // Fixed-height envelope (matches the ring's own footprint) so switching between
    // steps — ring vs. the much shorter amount form — never changes this component's
    // total height. Content that used to sit in-flow below the ring (the undo toast)
    // is now absolutely positioned inside this box for the same reason: it must not
    // add extra height that pushes ExtrasMenu/IncomeButton (anchored to an ancestor's
    // bottom-4) further down the page.
    <div
      className="relative flex w-full flex-col items-center justify-center gap-4 py-4"
      style={{ minHeight: `min(${WHEEL_SIZE}px, calc(100vw - 32px))` }}
    >
      {step !== 'amount' && !addingSubcategory && (
        <div
          className="relative mx-auto"
          onClick={(e) => {
            // The whole wheel background is a secret "home" button — tapping anywhere
            // that isn't an actual bubble/button closes back to the empty wheel. The ring
            // tracks below are pointer-events-none so a tap on the ring line itself still
            // counts as "background", not "hit something".
            if (e.target === e.currentTarget) reset()
          }}
          style={{
            // Viewport units give a definite size regardless of ancestor flex/percentage
            // quirks — a plain "100%" here previously collapsed to 0 on some layouts,
            // since every child of this div is position:absolute and contributes no
            // intrinsic size for a percentage to fall back on.
            width: `min(${WHEEL_SIZE}px, calc(100vw - 32px))`,
            height: `min(${WHEEL_SIZE}px, calc(100vw - 32px))`,
          }}
        >
          {/* Ring 1 track — always present, even at rest on the closed wheel. */}
          <div className="pointer-events-none absolute rounded-full border-teal/30" style={ringTrackStyle(RING_1_RADIUS, 6)} />

          {/* Ring 2 track — only appears once a category is picked, thinner than ring 1. */}
          {step === 'subcategory' && (
            <div className="pointer-events-none absolute rounded-full border-teal/30" style={ringTrackStyle(RING_2_RADIUS, 3)} />
          )}

          {step === 'closed' && (
            <>
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70"
                style={{ width: `${pct(CENTER_BUTTON_SIZE + 12)}%`, height: `${pct(CENTER_BUTTON_SIZE + 12)}%` }}
              />
              <button
                type="button"
                onClick={() => setStep('category')}
                aria-label="Agregar movimiento"
                className="wheel-button absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-teal font-display text-5xl font-bold text-white"
                style={{ width: `${pct(CENTER_BUTTON_SIZE)}%`, height: `${pct(CENTER_BUTTON_SIZE)}%` }}
              >
                +
              </button>
            </>
          )}

          {step === 'category' && !pendingCategory && (
            <button
              type="button"
              onClick={reset}
              aria-label="Cerrar"
              className="wheel-button absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-teal font-display text-4xl font-bold text-white"
              style={{ width: `${pct(CENTER_BUTTON_SIZE)}%`, height: `${pct(CENTER_BUTTON_SIZE)}%` }}
            >
              ×
            </button>
          )}

          {step === 'category' && pendingCategory && (
            <div
              aria-hidden="true"
              className="animate-center-fade-in absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full bg-teal p-2"
              style={{ width: `${pct(CENTER_BUTTON_SIZE)}%`, height: `${pct(CENTER_BUTTON_SIZE)}%` }}
            >
              <span style={{ transform: 'scale(1.07)' }}>
                <CategoryBadge name={pendingCategory.name} size="md" />
              </span>
              <span className="max-w-[92px] truncate text-[12px] font-medium text-white">{pendingCategory.name}</span>
            </div>
          )}

          {step === 'subcategory' && selectedCategory && (
            <button
              type="button"
              onClick={() => setStep('category')}
              aria-label="Volver a categorías"
              className="wheel-button absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full bg-teal p-2"
              style={{ width: `${pct(CENTER_BUTTON_SIZE)}%`, height: `${pct(CENTER_BUTTON_SIZE)}%` }}
            >
              <span style={{ transform: 'scale(1.07)' }}>
                <CategoryBadge name={selectedCategory.name} size="md" />
              </span>
              <span className="max-w-[92px] truncate text-[12px] font-medium text-white">{selectedCategory.name}</span>
            </button>
          )}

          {step === 'category' && categories && (
            <RingLayout
              items={categories.map((c) => ({ id: c.id, label: c.name }))}
              radius={RING_1_RADIUS}
              buttonSize={categoryButtonSize(categories.length)}
              badgeSize="sm"
              exitingId={pendingCategoryId}
              onPick={pickCategory}
            />
          )}

          {step === 'subcategory' && subcategories && subcategories.length > 0 && (
            <RingLayout
              items={subcategories.map((s) => ({ id: s.id, label: s.name }))}
              radius={RING_2_RADIUS}
              buttonSize={SUBCATEGORY_BUTTON_SIZE}
              badgeSize="sm"
              exitingId={pendingSubcategoryId}
              onPick={pickSubcategory}
              trailingAction={{ label: 'Agregar', onClick: () => setAddingSubcategory(true) }}
            />
          )}
        </div>
      )}

      {step === 'subcategory' && addingSubcategory && selectedCategory && (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button type="button" onClick={() => setAddingSubcategory(false)} className="self-center text-sm text-ink-soft">
            ← Volver
          </button>
          <p className="text-center text-sm text-ink-soft">
            Nueva subcategoría dentro de <span className="font-medium text-ink">{selectedCategory.name}</span>
          </p>
          <input
            type="text"
            autoFocus
            placeholder="Nombre de la subcategoría"
            value={newSubcategoryName}
            onChange={(e) => setNewSubcategoryName(e.target.value)}
            className="rounded-app border border-ink/10 bg-pearl px-4 py-3 text-center text-lg outline-none"
          />
          <button
            type="button"
            onClick={createAndSelectSubcategory}
            disabled={!newSubcategoryName.trim()}
            className="rounded-app bg-teal px-4 py-3 text-lg font-medium text-white disabled:opacity-40"
          >
            Agregar y continuar
          </button>
        </div>
      )}

      {undoTx && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <button type="button" onClick={undo} className="rounded-app bg-ink px-4 py-2 text-sm text-pearl shadow">
            Guardado
          </button>
        </div>
      )}

      {step === 'amount' && (
        <div className="animate-panel-fade-in flex w-full max-w-xs flex-col gap-4">
          <button type="button" onClick={reset} className="self-center text-sm text-ink-soft">
            Cancelar ×
          </button>

          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-3xl font-semibold text-ink-soft">
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

          {!showWho && !whoId ? (
            <button
              type="button"
              onClick={() => setShowWho(true)}
              className="self-center rounded-app bg-teal px-3 py-1.5 text-sm text-white active:scale-95"
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
                  className={`rounded-app px-3 py-1.5 text-sm bg-teal text-white ${
                    who.id === whoId ? 'ring-2 ring-white' : 'opacity-80'
                  }`}
                >
                  {who.name}
                </button>
              ))}
            </div>
          )}

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm"
          />

          <input
            type="text"
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-app border border-ink/10 bg-surface px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={save}
            disabled={!amount || Number(amount) <= 0}
            className="self-center text-base font-medium text-ink disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  )
}
