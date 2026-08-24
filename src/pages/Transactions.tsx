import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { deleteTransaction, exportTransactionsCsv } from '../db/repo'
import { CategoryBadge } from '../components/CategoryBadge'

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

async function handleDownloadCsv() {
  const csv = await exportTransactionsCsv()
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `finanzas-movimientos-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function Transactions() {
  const rows = useLiveQuery(async () => {
    const txs = await db.transactions.toArray()
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
      {rows?.length === 0 && <p className="text-xs text-ink-soft">Nada registrado todavía.</p>}
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
                onClick={() => deleteTransaction(tx.id)}
                className="text-[10px] text-ink-soft underline"
              >
                Borrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
