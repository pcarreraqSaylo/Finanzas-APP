import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { currentYearMonth, monthRange } from '../db/repo'
import { CategoryBadge } from './CategoryBadge'

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export function KpiStrip() {
  const yearMonth = currentYearMonth()
  const settings = useLiveQuery(() => db.userSettings.get('default'))
  const currency = settings?.currencyDefault ?? 'MXN'

  const today = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysRemaining = daysInMonth - dayOfMonth

  const totals = useLiveQuery(async () => {
    const { start, end } = monthRange(yearMonth)
    const txs = await db.transactions.where('date').between(start, end, true, true).toArray()
    let income = 0
    let expense = 0
    for (const tx of txs) {
      if (tx.type === 'income') income += tx.totalAmount
      else expense += tx.totalAmount
    }
    return { income, expense, balance: income - expense }
  }, [yearMonth])

  const pctOfIncome = totals && totals.income > 0 ? Math.round((totals.expense / totals.income) * 100) : null
  const avgDaily = totals ? totals.expense / dayOfMonth : 0

  const topExpenseCategories = useLiveQuery(async () => {
    const { start, end } = monthRange(yearMonth)
    const txs = await db.transactions.where('date').between(start, end, true, true).toArray()
    const expenseTxIds = new Set(txs.filter((t) => t.type === 'expense').map((t) => t.id))
    if (expenseTxIds.size === 0) return []

    const splits = await db.transactionSplits.toArray()
    const categories = await db.categories.toArray()
    const categoryById = new Map(categories.map((c) => [c.id, c]))

    const totalsByCategory = new Map<string, number>()
    let totalExpense = 0
    for (const split of splits) {
      if (!expenseTxIds.has(split.transactionId)) continue
      totalsByCategory.set(split.categoryId, (totalsByCategory.get(split.categoryId) ?? 0) + split.amount)
      totalExpense += split.amount
    }

    return Array.from(totalsByCategory.entries())
      .map(([categoryId, amount]) => ({
        category: categoryById.get(categoryId),
        amount,
        pct: totalExpense ? Math.round((amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
  }, [yearMonth])

  return (
    // The blob IS the card now — one organic teal shape holding all the hero content,
    // no separate gray rectangle underneath it.
    <div
      className="relative flex flex-col gap-1 bg-teal px-4 pt-3 pb-4 text-white"
      style={{ borderRadius: '0% 0% 55% 45% / 0% 0% 12% 9%' }}
    >
      <Link to="/analytics" className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-[10px] uppercase tracking-wide text-white/75">Balance este mes</span>
        <span className="font-display text-2xl font-semibold text-white">
          {formatMoney(totals?.balance ?? 0, currency)}
        </span>
        <span className="text-[10px] text-white/75">
          {formatMoney(avgDaily, currency)}/día · Día {dayOfMonth}/{daysInMonth} · {daysRemaining}{' '}
          {daysRemaining === 1 ? 'restante' : 'restantes'}
        </span>
      </Link>

      <div className="flex items-center justify-between text-[10px] text-white/85">
        <span className="text-expense">↓ {formatMoney(totals?.expense ?? 0, currency)}</span>
        <span>{pctOfIncome === null ? '—' : `${pctOfIncome}% del ingreso`}</span>
      </div>

      <div className="mt-0.5 border-t border-white/20 pt-1">
        <span className="text-[9px] font-medium uppercase tracking-wide text-white/75">Top 3 gastos del mes</span>
        <div className="mt-1 flex items-start justify-around gap-1">
          {topExpenseCategories?.length ? (
            topExpenseCategories.map(({ category, amount, pct }) => (
              <div key={category?.id} className="flex w-[92px] flex-col items-center gap-0.5 text-center">
                <CategoryBadge name={category?.name ?? '—'} size="xs" />
                <span className="whitespace-normal text-[10px] leading-tight text-white">{category?.name}</span>
                <span className="text-[10px] font-semibold text-white">{formatMoney(amount, currency)}</span>
                <span className="text-[9px] text-white/75">{pct}%</span>
              </div>
            ))
          ) : (
            <span className="text-xs text-white/75">Sin gastos este mes.</span>
          )}
        </div>
      </div>
    </div>
  )
}
