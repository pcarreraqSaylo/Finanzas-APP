import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { deleteCategory, ensureUncategorizedCategory } from '../db/repo'
import type { Category } from '../db/types'

const UNCATEGORIZED = 'uncategorized' as const

export function ConfirmDeleteCategoryModal({
  category,
  siblings,
  onClose,
}: {
  category: Category
  // Other categories of the same kind — reassignment targets. A transaction can't
  // switch from expense to income, so cross-kind categories are never offered.
  siblings: Category[]
  onClose: () => void
}) {
  const affectedCount = useLiveQuery(
    () => db.transactionSplits.where('categoryId').equals(category.id).count(),
    [category.id],
  )
  const [reassignTo, setReassignTo] = useState<string>(siblings[0]?.id ?? UNCATEGORIZED)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    setDeleting(true)
    const targetId = reassignTo === UNCATEGORIZED ? await ensureUncategorizedCategory(category.kind) : reassignTo
    await deleteCategory(category.id, targetId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-app bg-surface p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">Eliminar categoría</span>
          <button type="button" onClick={onClose} className="text-sm font-medium text-ink">
            Cancelar
          </button>
        </div>

        {affectedCount === undefined ? (
          <p className="text-sm text-ink-soft">Cargando…</p>
        ) : affectedCount === 0 ? (
          <p className="text-sm text-ink-soft">
            ¿Eliminar <span className="font-medium text-ink">"{category.name}"</span> y sus subcategorías? Esta
            acción no se puede deshacer.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              <span className="font-medium text-ink">"{category.name}"</span> tiene {affectedCount}{' '}
              {affectedCount === 1 ? 'movimiento' : 'movimientos'}. ¿A qué categoría se reasignan antes de
              eliminarla? (No se pierden los movimientos.)
            </p>
            <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
              {siblings.map((sib) => (
                <button
                  key={sib.id}
                  type="button"
                  onClick={() => setReassignTo(sib.id)}
                  className={`flex items-center justify-between rounded-app border px-3 py-2 text-left text-sm ${
                    reassignTo === sib.id
                      ? 'border-teal bg-teal/10 font-medium text-ink'
                      : 'border-ink/10 bg-surface-tint text-ink-soft'
                  }`}
                >
                  {sib.name}
                  {reassignTo === sib.id && <span className="text-teal">✓</span>}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setReassignTo(UNCATEGORIZED)}
                className={`flex items-center justify-between rounded-app border px-3 py-2 text-left text-sm ${
                  reassignTo === UNCATEGORIZED
                    ? 'border-teal bg-teal/10 font-medium text-ink'
                    : 'border-ink/10 bg-surface-tint text-ink-soft'
                }`}
              >
                Dejar como "Sin categoría"
                {reassignTo === UNCATEGORIZED && <span className="text-teal">✓</span>}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={confirmDelete}
          disabled={affectedCount === undefined || deleting}
          className="mt-4 w-full rounded-app bg-expense px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {deleting ? 'Eliminando…' : 'Eliminar'}
        </button>
      </div>
    </div>
  )
}
