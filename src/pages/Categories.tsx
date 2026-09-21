import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import type { Category, Kind, Subcategory } from '../db/types'
import { CategoryBadge } from '../components/CategoryBadge'
import { ConfirmDeleteCategoryModal } from '../components/ConfirmDeleteCategoryModal'
import { ConfirmDeleteSubcategoryModal } from '../components/ConfirmDeleteSubcategoryModal'

export function Categories() {
  const [kind, setKind] = useState<Kind>('expense')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubName, setNewSubName] = useState<Record<string, string>>({})
  const [subToDelete, setSubToDelete] = useState<Subcategory | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

  const categories = useLiveQuery(() => db.categories.where('kind').equals(kind).sortBy('sortOrder'), [kind])
  const subcategories = useLiveQuery(() => db.subcategories.toArray())

  async function addCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    const count = await db.categories.where('kind').equals(kind).count()
    await db.categories.add({
      id: uuid(),
      name,
      kind,
      icon: '',
      sortOrder: count,
      createdAt: Date.now(),
    })
    setNewCategoryName('')
  }

  async function addSubcategory(categoryId: string) {
    const name = (newSubName[categoryId] ?? '').trim()
    if (!name) return
    const count = await db.subcategories.where('categoryId').equals(categoryId).count()
    await db.subcategories.add({ id: uuid(), categoryId, name, icon: null, sortOrder: count })
    setNewSubName((prev) => ({ ...prev, [categoryId]: '' }))
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="font-display text-2xl font-semibold">Categorías</h1>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind('expense')}
          className={`rounded-app px-4 py-2 text-sm ${kind === 'expense' ? 'bg-teal text-white' : 'border border-ink/10 bg-surface text-ink-soft'}`}
        >
          Gasto
        </button>
        <button
          type="button"
          onClick={() => setKind('income')}
          className={`rounded-app px-4 py-2 text-sm ${kind === 'income' ? 'bg-teal text-white' : 'border border-ink/10 bg-surface text-ink-soft'}`}
        >
          Ingreso
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {categories?.map((category) => (
          <div key={category.id} className="rounded-app border border-ink/10 bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <CategoryBadge name={category.name} size="sm" />
                {category.name}
              </span>
              <button type="button" onClick={() => setCategoryToDelete(category)} className="text-xs text-ink-soft underline">
                Borrar
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {subcategories
                ?.filter((s) => s.categoryId === category.id)
                .map((sub) => (
                  <span key={sub.id} className="flex items-center gap-1 rounded-app bg-pearl px-2 py-1 text-xs">
                    {sub.name}
                    <button type="button" onClick={() => setSubToDelete(sub)} className="text-ink-soft">
                      ×
                    </button>
                  </span>
                ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Nueva subcategoría"
                value={newSubName[category.id] ?? ''}
                onChange={(e) => setNewSubName((prev) => ({ ...prev, [category.id]: e.target.value }))}
                className="flex-1 rounded-app bg-pearl px-2 py-1 text-xs outline-none"
              />
              <button type="button" onClick={() => addSubcategory(category.id)} className="text-xs text-teal">
                Agregar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nueva categoría"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          className="flex-1 rounded-app border border-ink/10 bg-pearl px-3 py-2 text-sm outline-none"
        />
        <button type="button" onClick={addCategory} className="rounded-app bg-teal px-4 py-2 text-sm text-white">
          Agregar
        </button>
      </div>

      {subToDelete && (
        <ConfirmDeleteSubcategoryModal
          subcategory={subToDelete}
          siblings={subcategories?.filter((s) => s.categoryId === subToDelete.categoryId && s.id !== subToDelete.id) ?? []}
          onClose={() => setSubToDelete(null)}
        />
      )}

      {categoryToDelete && (
        <ConfirmDeleteCategoryModal
          category={categoryToDelete}
          siblings={categories?.filter((c) => c.id !== categoryToDelete.id) ?? []}
          onClose={() => setCategoryToDelete(null)}
        />
      )}
    </div>
  )
}
