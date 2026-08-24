import { v4 as uuid } from 'uuid'
import { db } from './db'

// `icon` is reserved for a future curated pictogram set (see CONSTITUTION.md) —
// left blank for now; the UI renders a lettermark badge from `name` instead.
const EXPENSE_CATEGORIES: Array<{ name: string; subcategories: string[] }> = [
  { name: 'Comida y Bebida', subcategories: ['Groceries', 'Restaurantes', 'Bares y bebidas', 'Delivery'] },
  { name: 'Transporte', subcategories: ['Gasolina', 'Uber/Didi', 'Transporte público', 'Estacionamiento', 'Mantenimiento'] },
  { name: 'Salud y Bienestar', subcategories: ['Terapia', 'Self Care', 'Deporte'] },
  { name: 'Compras', subcategories: ['Ropa y accesorios', 'Gadgets', 'Regalos', 'Hogar'] },
  { name: 'Entretenimiento', subcategories: ['Eventos en vivo', 'Suscripciones', 'Salidas nocturnas', 'Cine'] },
  { name: 'Administrativo', subcategories: ['Documentos y licencias', 'Impuestos'] },
  { name: 'Otros', subcategories: [] },
]

const INCOME_CATEGORIES = ['Sueldo', 'Freelance', 'Bonos', 'Regalos / dinero recibido', 'Rendimientos', 'Otros ingresos']

const WHO_OPTIONS = ['Me only', 'Me & friends', 'Family', 'Pareja']

export async function seedIfEmpty() {
  const categoryCount = await db.categories.count()
  if (categoryCount > 0) return

  let sortOrder = 0
  for (const cat of EXPENSE_CATEGORIES) {
    const categoryId = uuid()
    await db.categories.add({
      id: categoryId,
      name: cat.name,
      kind: 'expense',
      icon: '',
      sortOrder: sortOrder++,
      createdAt: Date.now(),
    })
    let subSort = 0
    for (const subName of cat.subcategories) {
      await db.subcategories.add({
        id: uuid(),
        categoryId,
        name: subName,
        icon: null,
        sortOrder: subSort++,
      })
    }
  }

  sortOrder = 0
  for (const name of INCOME_CATEGORIES) {
    await db.categories.add({
      id: uuid(),
      name,
      kind: 'income',
      icon: '',
      sortOrder: sortOrder++,
      createdAt: Date.now(),
    })
  }

  let whoSort = 0
  for (const name of WHO_OPTIONS) {
    await db.whoOptions.add({ id: uuid(), name, sortOrder: whoSort++ })
  }

  const existingSettings = await db.userSettings.get('default')
  if (!existingSettings) {
    await db.userSettings.add({ id: 'default', currencyDefault: 'MXN', theme: 'blue' })
  }
}

// Siniestros (one-off, out-of-the-ordinary expenses — accidents, theft, emergencies)
// is a real expense category so it rolls up into Analytics/Transactions like any
// other, but it's deliberately excluded from the main Entry Wheel's category ring
// (see EntryWheel.tsx) — the only way to log one is via the Extras menu.
export async function ensureSiniestrosCategory() {
  const existing = await db.categories.where('name').equals('Siniestros').first()
  if (existing) return
  const count = await db.categories.where('kind').equals('expense').count()
  await db.categories.add({
    id: uuid(),
    name: 'Siniestros',
    kind: 'expense',
    icon: '',
    sortOrder: count,
    createdAt: Date.now(),
  })
}

// One-time fixup for databases already seeded before the Transporte/Administrativo
// subcategory naming cleanup — renames in place (existing transaction_splits keep
// pointing at the same id) and drops the subcategory that got cut entirely.
export async function fixupRenamedSubcategories() {
  const parquimetro = await db.subcategories.where('name').equals('Parquímetro/Estacionamiento').first()
  if (parquimetro) {
    await db.subcategories.update(parquimetro.id, { name: 'Estacionamiento' })
  }
  const comisiones = await db.subcategories.where('name').equals('Comisiones bancarias').first()
  if (comisiones) {
    await db.subcategories.delete(comisiones.id)
  }
}
