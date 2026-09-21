import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import {
  currentYearMonth,
  deleteTransaction,
  exportTransactionsCsv,
  monthRange,
  shiftYearMonth,
  todayLocalDate,
} from '../db/repo'
import { CategoryBadge } from '../components/CategoryBadge'
import { EditTransactionModal } from '../components/EditTransactionModal'
import type { Transaction } from '../db/types'

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

async function handleDownloadCsv() {
  const csv = await exportTransactionsCsv()
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `finanzas-movimientos-${todayLocalDate()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function Transactions() {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [monthOffset, setMonthOffset] = useState(0)
  const yearMonth = shiftYearMonth(currentYearMonth(), monthOffset)
  const { start, end } = monthRange(yearMonth)

  const rows = useLiveQuery(async () => {
    const txs = (await db.transactions.toArray()).filter((t) => t.date >= start && t.date <= end)
    // Chronological: by date first, then by the exact moment it was logged within that
    // date — never displayed, just used so same-day entries land in the right order.
    txs.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.createdAt - a.createdAt))

    const categories = await db.categories.toArray()
    const subcategories = await db.subcategories.toArray()
    const splits = await db.transactionSplits.toArray()
    const whoOptions = await db.whoOptions.toArray()

    const categoryById = new Map(categories.map((c) => [c.id, c]))
    const subcategoryById = new Map(subcategories.map((s) => [s.id, s]))
    const whoById = new Map(whoOptions.map((w) => [w.id, w]))
    const splitsByTx = new Map<string, typeof splits>()
    for (const split of splits) {
      const list = splitsByTx.get(split.transactionId) ?? []
      list.push(split)
      splitsByTx.set(split.transactionId, list)
    }

    return txs.map((tx) => {
      const txSplits = splitsByTx.get(tx.id) ?? []
      const primaryCategory = txSplits[0] ? categoryById.get(txSplits[0].categoryId) : undefined
      const labels = txSplits.map((s) => {
        const cat = categoryById.get(s.categoryId)
        const sub = s.subcategoryId ? subcategoryById.get(s.subcategoryId) : null
        return `${cat?.name ?? '—'}${sub ? ` · ${sub.name}` : ''}`
      })
      return {
        tx,
        label: labels.join(' + ') || '—',
        primaryCategoryName: primaryCategory?.name ?? '—',
        who: tx.whoId ? whoById.get(tx.whoId)?.name : null,
      }
    })
  })

  return (
    <div className="flex flex-1 flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-semibold">Movimientos</h1>
        <button
          type="button"
          onClick={handleDownloadCsv}
          className="rounded-app border border-ink/10 bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-soft"
        >
          Descargar CSV
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonthOffset((o) => o - 1)}
          aria-label="Mes anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-soft ring-1 ring-ink/10 active:scale-95"
        >
          ‹
        </button>
        <h2 className="font-display text-sm font-semibold text-ink">{formatMonthLabel(yearMonth)}</h2>
        <button
          type="button"
          onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
          aria-label="Mes siguiente"
          disabled={monthOffset === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-soft ring-1 ring-ink/10 active:scale-95 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      {rows?.length === 0 && <p className="text-xs text-ink-soft">Nada registrado en este mes.</p>}
      <div className="flex flex-col gap-1.5">
        {rows?.map(({ tx, label, primaryCategoryName, who }) => (
          <div key={tx.id} className="flex items-center gap-2 rounded-app border border-ink/10 bg-surface px-2.5 py-1.5">
            <CategoryBadge name={primaryCategoryName} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{label}</div>
              <div className="truncate text-[10px] text-ink-soft">
                {tx.date}
                {who ? ` · ${who}` : ''}
                {tx.note ? ` · ${tx.note}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                {tx.type === 'income' ? '+' : '-'}
                {formatMoney(tx.totalAmount, tx.currency)}
              </span>
              <button
                type="button"
                onClick={() => setEditingTx(tx)}
                aria-label="Editar"
                className="flex h-6 w-6 shrink-0 items-center justify-center text-cornflower active:scale-90"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => deleteTransaction(tx.id)}
                aria-label="Borrar"
                className="flex h-6 w-6 shrink-0 items-center justify-center text-expense active:scale-90"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      {editingTx && <EditTransactionModal transaction={editingTx} onClose={() => setEditingTx(null)} />}
    </div>
  )
}
