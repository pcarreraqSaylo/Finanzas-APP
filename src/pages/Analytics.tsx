import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { currentYearMonth, monthRange, shiftYearMonth } from '../db/repo'
import { CategoryBadge } from '../components/CategoryBadge'

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatMonthShort(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number)
  return new Date(year, month - 1, 1)
    .toLocaleDateString('es-MX', { month: 'short' })
    .replace('.', '')
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function daysBetween(start: string, end: string) {
  const startMs = new Date(`${start}T00:00:00`).getTime()
  const endMs = new Date(`${end}T00:00:00`).getTime()
  return Math.round((endMs - startMs) / 86_400_000) + 1
}

// Monday-first weekday counts (0..6) for every day in [start, end] — works for a
// single month or a multi-month YTD range alike.
function weekdayCountsInRange(start: string, end: string) {
  const counts = Array(7).fill(0)
  const startMs = new Date(`${start}T00:00:00`).getTime()
  const days = daysBetween(start, end)
  for (let i = 0; i < days; i++) {
    const day = new Date(startMs + i * 86_400_000).getDay() // 0 Sun .. 6 Sat
    counts[(day + 6) % 7]++
  }
  return counts
}

function mondayFirstIndex(dateStr: string) {
  const day = new Date(`${dateStr}T00:00:00`).getDay()
  return (day + 6) % 7
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-app border border-ink/10 bg-surface px-2 py-3 text-center">
      <span className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</span>
      <span className="font-display text-lg font-semibold text-ink">{value}</span>
      {sub && <span className="max-w-full truncate text-[10px] text-ink-soft">{sub}</span>}
    </div>
  )
}

type BreakdownDimension = 'category' | 'who'
type ViewMode = 'month' | 'ytd'

export function Analytics() {
  const [monthOffset, setMonthOffset] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const [dimension, setDimension] = useState<BreakdownDimension>('category')
  const yearMonth = shiftYearMonth(currentYearMonth(), monthOffset)

  const settings = useLiveQuery(() => db.userSettings.get('default'))
  const currency = settings?.currencyDefault ?? 'MXN'

  const data = useLiveQuery(async () => {
    const [txs, splits, categories, subcategories, whoOptions] = await Promise.all([
      db.transactions.toArray(),
      db.transactionSplits.toArray(),
      db.categories.toArray(),
      db.subcategories.toArray(),
      db.whoOptions.toArray(),
    ])
    return { txs, splits, categories, subcategories, whoOptions }
  })

  const stats = useMemo(() => {
    if (!data) return null
    const { txs, splits, categories, subcategories, whoOptions } = data
    const categoryById = new Map(categories.map((c) => [c.id, c]))
    const subcategoryById = new Map(subcategories.map((s) => [s.id, s]))
    const whoById = new Map(whoOptions.map((w) => [w.id, w]))
    const txById = new Map(txs.map((t) => [t.id, t]))

    function totalsForRange(start: string, end: string) {
      const rangeTxs = txs.filter((t) => t.date >= start && t.date <= end)
      let income = 0
      let expense = 0
      for (const t of rangeTxs) {
        if (t.type === 'income') income += t.totalAmount
        else expense += t.totalAmount
      }
      return { income, expense, txs: rangeTxs }
    }

    // Everything below reads from one {start, end} window — "month" mode is the
    // selected month; "ytd" mode is always the real current year through today,
    // independent of month navigation. Toggling the mode is what makes every
    // section on the page (tiles, breakdown, weekday pattern, record chart)
    // recompute against a different window — there's no separate YTD-only path.
    let periodStart: string
    let periodEnd: string
    let compareLabel: string
    let compareTotals: { income: number; expense: number }
    let periodLabel: string
    let monthsInPeriod: number

    if (viewMode === 'month') {
      const mr = monthRange(yearMonth)
      periodStart = mr.start
      periodEnd = mr.end
      const prevMr = monthRange(shiftYearMonth(yearMonth, -1))
      compareTotals = totalsForRange(prevMr.start, prevMr.end)
      compareLabel = 'Vs. mes pasado'
      periodLabel = formatMonthLabel(yearMonth)
      monthsInPeriod = 1
    } else {
      const now = new Date()
      const year = now.getFullYear()
      periodStart = `${year}-01-01`
      periodEnd = now.toISOString().slice(0, 10)
      compareTotals = totalsForRange(`${year - 1}-01-01`, `${year - 1}-${periodEnd.slice(5)}`)
      compareLabel = 'Vs. año pasado'
      periodLabel = `${year} · año hasta la fecha`
      monthsInPeriod = now.getMonth() + 1
    }

    const current = totalsForRange(periodStart, periodEnd)
    const periodDays = daysBetween(periodStart, periodEnd)

    const expenseTxIds = new Set(current.txs.filter((t) => t.type === 'expense').map((t) => t.id))
    const byCategory = new Map<string, number>()
    const bySubcategory = new Map<string, Map<string, number>>()
    const byWho = new Map<string, number>()

    for (const split of splits) {
      if (!expenseTxIds.has(split.transactionId)) continue
      byCategory.set(split.categoryId, (byCategory.get(split.categoryId) ?? 0) + split.amount)
      if (split.subcategoryId) {
        const subMap = bySubcategory.get(split.categoryId) ?? new Map<string, number>()
        subMap.set(split.subcategoryId, (subMap.get(split.subcategoryId) ?? 0) + split.amount)
        bySubcategory.set(split.categoryId, subMap)
      }
      const tx = txById.get(split.transactionId)
      if (tx?.whoId) byWho.set(tx.whoId, (byWho.get(tx.whoId) ?? 0) + split.amount)
    }

    const categoryRows = Array.from(byCategory.entries())
      .map(([categoryId, amount]) => ({
        category: categoryById.get(categoryId),
        amount,
        pct: current.expense ? Math.round((amount / current.expense) * 100) : 0,
        subcategories: Array.from((bySubcategory.get(categoryId) ?? new Map()).entries())
          .map(([subId, amt]) => ({ subcategory: subcategoryById.get(subId), amount: amt }))
          .sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.amount - a.amount)

    const whoRows = Array.from(byWho.entries())
      .map(([whoId, amount]) => ({
        who: whoById.get(whoId),
        amount,
        pct: current.expense ? Math.round((amount / current.expense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    // Record — not a projection, just the actual income vs. expense per month, oldest
    // first. In month mode: the trailing 6 months. In YTD mode: January through the
    // current month. income doubles as the "budget" bar (what you actually made that
    // month) with expense as the marker on top, so over/under reads straight off it.
    const recordMonths =
      viewMode === 'month'
        ? Array.from({ length: 6 }, (_, i) => shiftYearMonth(yearMonth, i - 5))
        : Array.from({ length: monthsInPeriod }, (_, i) => `${periodStart.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`)
    const record = recordMonths.map((ym) => {
      const mr = monthRange(ym)
      const t = totalsForRange(mr.start, mr.end)
      return { yearMonth: ym, income: t.income, expense: t.expense }
    })

    // Weekday pattern across the whole active window — averaged per weekday since a
    // range rarely divides evenly into whole weeks.
    const weekdayCounts = weekdayCountsInRange(periodStart, periodEnd)
    const weekdayTotals = Array(7).fill(0)
    for (const tx of current.txs) {
      if (tx.type !== 'expense') continue
      weekdayTotals[mondayFirstIndex(tx.date)] += tx.totalAmount
    }
    const weekdayAverages = weekdayTotals.map((total, i) => (weekdayCounts[i] ? total / weekdayCounts[i] : 0))

    const pctOfIncome = current.income > 0 ? Math.round((current.expense / current.income) * 100) : null
    const deltaVsCompare =
      compareTotals.expense > 0 ? Math.round(((current.expense - compareTotals.expense) / compareTotals.expense) * 100) : null
    const avgWeekly = current.expense / (periodDays / 7)
    const avgMonthly = current.expense / monthsInPeriod

    return {
      periodLabel,
      compareLabel,
      income: current.income,
      expense: current.expense,
      pctOfIncome,
      deltaVsCompare,
      avgWeekly,
      avgMonthly,
      categoryRows,
      whoRows,
      record,
      weekdayAverages,
    }
  }, [data, yearMonth, viewMode])

  if (!stats) {
    return <div className="p-4 text-sm text-ink-soft">Cargando…</div>
  }

  const topCategory = stats.categoryRows[0]
  const topWho = stats.whoRows[0]
  const recordMax = Math.max(...stats.record.flatMap((m) => [m.income, m.expense]), 1)
  const weekdayMax = Math.max(...stats.weekdayAverages, 1)
  const weekdayPoints = stats.weekdayAverages.map((avg, i) => ({
    x: (i / (stats.weekdayAverages.length - 1)) * 100,
    // 80-unit range with 10-unit top/bottom padding so peaks/dips never touch the edge.
    y: 90 - (avg / weekdayMax) * 80,
  }))
  const weekdayLinePath = weekdayPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const weekdayAreaPath =
    `M ${weekdayPoints[0].x} 100 ` +
    weekdayPoints.map((p) => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${weekdayPoints[weekdayPoints.length - 1].x} 100 Z`

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonthOffset((o) => o - 1)}
          aria-label="Mes anterior"
          disabled={viewMode === 'ytd'}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-soft ring-1 ring-ink/10 active:scale-95 disabled:opacity-30"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-lg font-semibold">{stats.periodLabel}</h1>
          <button
            type="button"
            onClick={() => setViewMode((v) => (v === 'month' ? 'ytd' : 'month'))}
            className={`rounded-app px-2 py-1 text-xs font-semibold active:scale-95 ${
              viewMode === 'ytd' ? 'bg-teal text-white' : 'border border-ink/10 bg-surface text-ink-soft'
            }`}
          >
            YTD
          </button>
        </div>
        <button
          type="button"
          onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
          aria-label="Mes siguiente"
          disabled={viewMode === 'ytd' || monthOffset === 0}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-soft ring-1 ring-ink/10 active:scale-95 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDimension('category')}
          className={`flex-1 rounded-app px-3 py-2.5 text-sm font-medium ${
            dimension === 'category' ? 'bg-teal text-white' : 'border border-ink/10 bg-surface text-ink-soft'
          }`}
        >
          Por categoría
        </button>
        <button
          type="button"
          onClick={() => setDimension('who')}
          className={`flex-1 rounded-app px-3 py-2.5 text-sm font-medium ${
            dimension === 'who' ? 'bg-teal text-white' : 'border border-ink/10 bg-surface text-ink-soft'
          }`}
        >
          Por "Who"
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile
          label={stats.compareLabel}
          value={stats.deltaVsCompare === null ? '—' : `${stats.deltaVsCompare > 0 ? '+' : ''}${stats.deltaVsCompare}%`}
        />
        {dimension === 'category' ? (
          <StatTile label="Top categoría" value={topCategory ? `${topCategory.pct}%` : '—'} sub={topCategory?.category?.name} />
        ) : (
          <StatTile label="Top Who" value={topWho ? `${topWho.pct}%` : '—'} sub={topWho?.who?.name} />
        )}
        <StatTile label="Del ingreso gastado" value={stats.pctOfIncome === null ? '—' : `${stats.pctOfIncome}%`} />
        <StatTile label="Gasto semanal prom." value={formatMoney(stats.avgWeekly, currency)} />
        <StatTile label="Gasto mensual prom." value={formatMoney(stats.avgMonthly, currency)} />
      </div>

      <section className="flex flex-col gap-1 rounded-app border border-ink/10 bg-surface p-3">
        <h2 className="mb-1 text-sm font-semibold text-ink">{dimension === 'category' ? 'Por categoría' : 'Por "Who"'}</h2>

        {dimension === 'category' ? (
          <>
            {stats.categoryRows.length === 0 && <p className="text-sm text-ink-soft">Sin gastos en este periodo.</p>}
            {stats.categoryRows.map((row) => {
              const categoryId = row.category?.id ?? ''
              const isExpanded = expandedCategoryId === categoryId
              return (
                <div key={categoryId}>
                  <button
                    type="button"
                    onClick={() => setExpandedCategoryId(isExpanded ? null : categoryId)}
                    className="flex w-full items-center gap-2 py-1.5 text-left"
                  >
                    <CategoryBadge name={row.category?.name ?? '—'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{row.category?.name}</span>
                        <span className="ml-2 shrink-0 font-medium">{formatMoney(row.amount, currency)}</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-pearl">
                        <div className="h-2 rounded-full bg-teal" style={{ width: `${Math.max(row.pct, 3)}%` }} />
                      </div>
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs text-ink-soft">{row.pct}%</span>
                  </button>
                  {isExpanded && row.subcategories.length > 0 && (
                    <div className="ml-10 flex flex-col gap-1 pb-2">
                      {row.subcategories.map((s) => (
                        <div key={s.subcategory?.id ?? 'none'} className="flex items-center justify-between text-xs text-ink-soft">
                          <span>{s.subcategory?.name ?? 'Sin subcategoría'}</span>
                          <span>{formatMoney(s.amount, currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        ) : (
          <>
            {stats.whoRows.length === 0 && <p className="text-sm text-ink-soft">Sin datos de "Who" en este periodo.</p>}
            {stats.whoRows.map((row) => (
              <div key={row.who?.id} className="flex items-center gap-2 py-1.5">
                <CategoryBadge name={row.who?.name ?? '—'} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{row.who?.name}</span>
                    <span className="ml-2 shrink-0 font-medium">{formatMoney(row.amount, currency)}</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-pearl">
                    <div className="h-2 rounded-full bg-teal" style={{ width: `${Math.max(row.pct, 3)}%` }} />
                  </div>
                </div>
                <span className="w-9 shrink-0 text-right text-xs text-ink-soft">{row.pct}%</span>
              </div>
            ))}
          </>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-app border border-ink/10 bg-surface p-3">
        <h2 className="text-sm font-semibold text-ink">
          Historial · ingreso vs. gasto {viewMode === 'ytd' ? '(YTD)' : '(6 meses)'}
        </h2>
        <p className="text-xs text-ink-soft">Barra = ingreso · Punto = gasto</p>
        <div className="flex items-end justify-between gap-2 pt-2">
          {stats.record.map((m) => {
            const incomeHeightPct = Math.max((m.income / recordMax) * 100, 2)
            const expenseHeightPct = Math.max((m.expense / recordMax) * 100, 2)
            const overBudget = m.expense > m.income
            const pctDiff = m.income > 0 ? Math.round(((m.expense - m.income) / m.income) * 100) : null
            return (
              <div key={m.yearMonth} className="flex flex-1 flex-col items-center gap-1">
                <span className={`text-[10px] font-semibold ${pctDiff === null ? 'text-ink-soft' : overBudget ? 'text-expense' : 'text-income'}`}>
                  {pctDiff === null ? '—' : `${pctDiff > 0 ? '+' : ''}${pctDiff}%`}
                </span>
                <div className="relative flex h-24 w-full items-end justify-center">
                  <div className="w-4 rounded-t-md bg-teal/20" style={{ height: `${incomeHeightPct}%` }} />
                  <div
                    className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-white ${
                      overBudget ? 'bg-expense' : 'bg-income'
                    }`}
                    style={{ bottom: `calc(${expenseHeightPct}% - 5px)` }}
                  />
                </div>
                <span className="text-[10px] text-ink-soft">{formatMonthShort(m.yearMonth)}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-app border border-ink/10 bg-surface p-3">
        <h2 className="text-sm font-semibold text-ink">Patrón por día de la semana</h2>
        <p className="text-xs text-ink-soft">Gasto promedio por día</p>
        <div className="relative h-24 w-full pt-2">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <path d={weekdayAreaPath} fill="var(--color-teal)" fillOpacity="0.12" stroke="none" />
            <path
              d={weekdayLinePath}
              fill="none"
              stroke="var(--color-teal)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {weekdayPoints.map((p, i) => (
            <div
              key={WEEKDAY_LABELS[i]}
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal ring-2 ring-white"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="flex-1 text-center text-[10px] text-ink-soft">
              {label}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
