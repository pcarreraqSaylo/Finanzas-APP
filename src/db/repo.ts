import { v4 as uuid } from 'uuid'
import { db } from './db'
import type { Kind } from './types'

export interface SplitInput {
  categoryId: string
  subcategoryId: string | null
  amount: number
}

export interface CreateTransactionInput {
  date: string
  type: Kind
  currency: string
  note?: string | null
  tripId?: string | null
  whoId?: string | null
  splits: SplitInput[]
}

export async function createTransaction(input: CreateTransactionInput) {
  const totalAmount = input.splits.reduce((sum, s) => sum + s.amount, 0)
  const transactionId = uuid()
  const now = Date.now()

  await db.transaction('rw', db.transactions, db.transactionSplits, async () => {
    await db.transactions.add({
      id: transactionId,
      date: input.date,
      type: input.type,
      currency: input.currency,
      totalAmount,
      note: input.note ?? null,
      tripId: input.tripId ?? null,
      recurringRuleId: null,
      whoId: input.whoId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    for (const split of input.splits) {
      await db.transactionSplits.add({
        id: uuid(),
        transactionId,
        categoryId: split.categoryId,
        subcategoryId: split.subcategoryId,
        amount: split.amount,
      })
    }
  })

  return transactionId
}

export async function deleteTransaction(transactionId: string) {
  await db.transaction('rw', db.transactions, db.transactionSplits, async () => {
    await db.transactionSplits.where('transactionId').equals(transactionId).delete()
    await db.transactions.delete(transactionId)
  })
}

export function monthRange(yearMonth: string): { start: string; end: string } {
  // yearMonth: "YYYY-MM"
  const [year, month] = yearMonth.split('-').map(Number)
  const start = `${yearMonth}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function dateForDayOfMonth(yearMonth: string, dayOfMonth: number): string {
  const { end } = monthRange(yearMonth)
  const lastDay = Number(end.slice(-2))
  const clamped = Math.min(Math.max(1, dayOfMonth), lastDay)
  return `${yearMonth}-${String(clamped).padStart(2, '0')}`
}

export interface CreateRecurringIncomeInput {
  categoryId: string
  amount: number
  currency: string
  dayOfMonth: number
  whoId?: string | null
  note?: string | null
}

// Salary-style income: set up once, then auto-logged every month at the same amount
// until edited (see updateRecurringRuleAmount) or stopped (see stopRecurringRule).
export async function createRecurringIncome(input: CreateRecurringIncomeInput) {
  const ruleId = uuid()
  await db.recurringRules.add({
    id: ruleId,
    categoryId: input.categoryId,
    subcategoryId: null,
    type: 'income',
    amount: input.amount,
    currency: input.currency,
    dayOfMonth: input.dayOfMonth,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: null,
    active: true,
    whoId: input.whoId ?? null,
    note: input.note ?? null,
  })
  await generateRecurringTransaction(ruleId, currentYearMonth())
  return ruleId
}

async function generateRecurringTransaction(ruleId: string, yearMonth: string) {
  const rule = await db.recurringRules.get(ruleId)
  if (!rule || !rule.active) return
  const alreadyGenerated = await db.transactions.where('recurringRuleId').equals(ruleId).toArray()
  if (alreadyGenerated.some((t) => t.date.startsWith(yearMonth))) return

  const transactionId = uuid()
  const now = Date.now()
  await db.transaction('rw', db.transactions, db.transactionSplits, async () => {
    await db.transactions.add({
      id: transactionId,
      date: dateForDayOfMonth(yearMonth, rule.dayOfMonth),
      type: rule.type,
      currency: rule.currency,
      totalAmount: rule.amount,
      note: rule.note,
      tripId: null,
      recurringRuleId: ruleId,
      whoId: rule.whoId,
      createdAt: now,
      updatedAt: now,
    })
    await db.transactionSplits.add({
      id: uuid(),
      transactionId,
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      amount: rule.amount,
    })
  })
}

// Called on app load — logs this month's occurrence for every active recurring rule
// that hasn't been generated yet, so salary etc. shows up automatically without the
// user having to re-enter it each month.
export async function ensureRecurringTransactionsForCurrentMonth() {
  const yearMonth = currentYearMonth()
  const rules = await db.recurringRules.toArray()
  for (const rule of rules) {
    if (!rule.active) continue
    if (rule.startDate.slice(0, 7) > yearMonth) continue
    if (rule.endDate && rule.endDate.slice(0, 7) < yearMonth) continue
    await generateRecurringTransaction(rule.id, yearMonth)
  }
}

// A raise (or pay cut) takes effect from the month it's made forward — past months
// already logged keep their original amount; this month's entry (if already
// auto-generated) is brought in line so it doesn't look like the change didn't apply.
export async function updateRecurringRuleAmount(ruleId: string, amount: number) {
  await db.recurringRules.update(ruleId, { amount })
  const yearMonth = currentYearMonth()
  const txs = await db.transactions.where('recurringRuleId').equals(ruleId).toArray()
  const currentMonthTx = txs.find((t) => t.date.startsWith(yearMonth))
  if (!currentMonthTx) return
  await db.transactions.update(currentMonthTx.id, { totalAmount: amount, updatedAt: Date.now() })
  const splits = await db.transactionSplits.where('transactionId').equals(currentMonthTx.id).toArray()
  if (splits[0]) await db.transactionSplits.update(splits[0].id, { amount })
}

export async function stopRecurringRule(ruleId: string) {
  await db.recurringRules.update(ruleId, { active: false, endDate: currentYearMonth() + '-01' })
}

function csvField(value: string | number): string {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

// One row per split, not per transaction — a split transaction's portions land
// in their own categories so per-category totals in the CSV add up correctly.
export async function exportTransactionsCsv(): Promise<string> {
  const [transactions, splits, categories, subcategories, whoOptions, trips] = await Promise.all([
    db.transactions.toArray(),
    db.transactionSplits.toArray(),
    db.categories.toArray(),
    db.subcategories.toArray(),
    db.whoOptions.toArray(),
    db.trips.toArray(),
  ])

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const subcategoryById = new Map(subcategories.map((s) => [s.id, s]))
  const whoById = new Map(whoOptions.map((w) => [w.id, w]))
  const tripById = new Map(trips.map((t) => [t.id, t]))
  const splitsByTx = new Map<string, typeof splits>()
  for (const split of splits) {
    const list = splitsByTx.get(split.transactionId) ?? []
    list.push(split)
    splitsByTx.set(split.transactionId, list)
  }

  const sorted = [...transactions].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.createdAt - a.createdAt,
  )

  const header = ['Fecha', 'Tipo', 'Categoria', 'Subcategoria', 'Monto', 'Moneda', 'Quien', 'Viaje', 'Nota']
  const lines = [header.join(',')]

  for (const tx of sorted) {
    for (const split of splitsByTx.get(tx.id) ?? []) {
      const row = [
        tx.date,
        tx.type === 'income' ? 'Ingreso' : 'Gasto',
        categoryById.get(split.categoryId)?.name ?? '',
        split.subcategoryId ? (subcategoryById.get(split.subcategoryId)?.name ?? '') : '',
        split.amount,
        tx.currency,
        tx.whoId ? (whoById.get(tx.whoId)?.name ?? '') : '',
        tx.tripId ? (tripById.get(tx.tripId)?.name ?? '') : '',
        tx.note ?? '',
      ]
      lines.push(row.map(csvField).join(','))
    }
  }

  return lines.join('\n')
}
