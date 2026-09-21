import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { deleteSubcategory } from '../db/repo'
import type { Subcategory } from '../db/types'

export function ConfirmDeleteSubcategoryModal({
  subcategory,
  siblings,
  onClose,
}: {
  subcategory: Subcategory
  // Other subcategories in the same category — reassignment targets, since a split
  // moving categories entirely doesn't make sense from here.
  siblings: Subcategory[]
  onClose: () => void
}) {
  const affectedCount = useLiveQuery(
    () => db.transactionSplits.where('subcategoryId').equals(subcategory.id).count(),
    [subcategory.id],
  )
  const [reassignTo, setReassignTo] = useState<string | null>(siblings[0]?.id ?? null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    setDeleting(true)
    await deleteSubcategory(subcategory.id, reassignTo)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-app bg-surface p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">Eliminar subcategoría</span>
          <button type="button" onClick={onClose} className="text-sm font-medium text-ink">
            Cancelar
          </button>
        </div>

        {affectedCount === undefined ? (
          <p className="text-sm text-ink-soft">Cargando…</p>
        ) : affectedCount === 0 ? (
          <p className="text-sm text-ink-soft">
            ¿Eliminar <span className="font-medium text-ink">"{subcategory.name}"</span>? Esta acción no se puede
            deshacer.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              <span className="font-medium text-ink">"{subcategory.name}"</span> tiene {affectedCount}{' '}
              {affectedCount === 1 ? 'movimiento' : 'movimientos'}. ¿A dónde se reasignan antes de eliminarla?
            </p>
            <div className="flex flex-col gap-1.5">
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
                onClick={() => setReassignTo(null)}
                className={`flex items-center justify-between rounded-app border px-3 py-2 text-left text-sm ${
                  reassignTo === null
                    ? 'border-teal bg-teal/10 font-medium text-ink'
                    : 'border-ink/10 bg-surface-tint text-ink-soft'
                }`}
              >
                Dejar sin subcategoría
                {reassignTo === null && <span className="text-teal">✓</span>}
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
