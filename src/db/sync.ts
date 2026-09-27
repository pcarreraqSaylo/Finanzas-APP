import { supabase } from '../lib/supabaseClient'
import { db } from './db'

// Two-pass sync: push everything local-only up first, then pull everything down —
// and pull only runs once push has fully succeeded, so a pull can never clobber a
// local edit that hasn't reached the server yet. This ordering alone is enough
// correctness for a single person using their own account across a couple of
// devices, without needing per-row last-write-wins comparison.
//
// Known limitation: deletions ARE propagated (see pushPendingDeletes), but there's
// no cross-device conflict resolution beyond "push wins, then pull is safe" — two
// devices editing the exact same row while both offline, then both coming online,
// isn't specifically handled. Rare enough for personal use that it's not worth the
// complexity yet.

let syncing = false
let lastResult: { ok: boolean; at: number; error?: string } | null = null

export function getLastSyncResult() {
  return lastResult
}

export async function syncNow(): Promise<{ ok: boolean; error?: string }> {
  if (syncing) return { ok: false, error: 'ya sincronizando' }
  syncing = true
  try {
    const { data, error: userError } = await supabase.auth.getUser()
    if (userError || !data.user) {
      const result = { ok: false, error: 'sesión no válida' }
      lastResult = { ...result, at: Date.now() }
      return result
    }
    const userId = data.user.id

    await pushPendingDeletes()
    await pushCategories(userId)
    await pushSubcategories(userId)
    await pushTrips(userId)
    await pushWhoOptions(userId)
    await pushRecurringRules(userId)
    await pushTransactions(userId)
    await pushTransactionSplits(userId)
    await pushUserSettings(userId)

    await pullCategories(userId)
    await pullSubcategories(userId)
    await pullTrips(userId)
    await pullWhoOptions(userId)
    await pullRecurringRules(userId)
    await pullTransactions(userId)
    await pullTransactionSplits(userId)
    await pullUserSettings(userId)

    lastResult = { ok: true, at: Date.now() }
    return { ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    lastResult = { ok: false, error, at: Date.now() }
    return { ok: false, error }
  } finally {
    syncing = false
  }
}

async function pushPendingDeletes() {
  const pending = await db.pendingDeletes.toArray()
  for (const entry of pending) {
    const { error } = await supabase.from(entry.table).delete().eq('id', entry.rowId)
    if (error) throw new Error(`delete ${entry.table}: ${error.message}`)
    if (entry.id !== undefined) await db.pendingDeletes.delete(entry.id)
  }
}

// ---- categories ----

async function pushCategories(userId: string) {
  const unsynced = (await db.categories.toArray()).filter((r) => r.synced !== true)
  if (unsynced.length === 0) return
  const { error } = await supabase.from('categories').upsert(
    unsynced.map((r) => ({
      id: r.id,
      user_id: userId,
      name: r.name,
      kind: r.kind,
      icon: r.icon,
      sort_order: r.sortOrder,
      created_at: new Date(r.createdAt).toISOString(),
    })),
  )
  if (error) throw new Error(`categories: ${error.message}`)
  await Promise.all(unsynced.map((r) => db.categories.update(r.id, { synced: true })))
}

async function pullCategories(userId: string) {
  const { data, error } = await supabase.from('categories').select('*').eq('user_id', userId)
  if (error) throw new Error(`categories: ${error.message}`)
  if (!data?.length) return
  await db.categories.bulkPut(
    data.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      icon: r.icon ?? '',
      sortOrder: r.sort_order,
      createdAt: new Date(r.created_at).getTime(),
      synced: true,
    })),
  )
}

// ---- subcategories ----

async function pushSubcategories(userId: string) {
  const unsynced = (await db.subcategories.toArray()).filter((r) => r.synced !== true)
  if (unsynced.length === 0) return
  const { error } = await supabase.from('subcategories').upsert(
    unsynced.map((r) => ({
      id: r.id,
      user_id: userId,
      category_id: r.categoryId,
      name: r.name,
      icon: r.icon,
      sort_order: r.sortOrder,
    })),
  )
  if (error) throw new Error(`subcategories: ${error.message}`)
  await Promise.all(unsynced.map((r) => db.subcategories.update(r.id, { synced: true })))
}

async function pullSubcategories(userId: string) {
  const { data, error } = await supabase.from('subcategories').select('*').eq('user_id', userId)
  if (error) throw new Error(`subcategories: ${error.message}`)
  if (!data?.length) return
  await db.subcategories.bulkPut(
    data.map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      name: r.name,
      icon: r.icon,
      sortOrder: r.sort_order,
      synced: true,
    })),
  )
}

// ---- trips ----

async function pushTrips(userId: string) {
  const unsynced = (await db.trips.toArray()).filter((r) => r.synced !== true)
  if (unsynced.length === 0) return
  const { error } = await supabase.from('trips').upsert(
    unsynced.map((r) => ({
      id: r.id,
      user_id: userId,
      name: r.name,
      start_date: r.startDate,
      end_date: r.endDate,
      merge_into_categories: r.mergeIntoCategories,
    })),
  )
  if (error) throw new Error(`trips: ${error.message}`)
  await Promise.all(unsynced.map((r) => db.trips.update(r.id, { synced: true })))
}

async function pullTrips(userId: string) {
  const { data, error } = await supabase.from('trips').select('*').eq('user_id', userId)
  if (error) throw new Error(`trips: ${error.message}`)
  if (!data?.length) return
  await db.trips.bulkPut(
    data.map((r) => ({
      id: r.id,
      name: r.name,
      startDate: r.start_date,
      endDate: r.end_date,
      mergeIntoCategories: r.merge_into_categories,
      synced: true,
    })),
  )
}

// ---- who options ----

async function pushWhoOptions(userId: string) {
  const unsynced = (await db.whoOptions.toArray()).filter((r) => r.synced !== true)
  if (unsynced.length === 0) return
  const { error } = await supabase
    .from('who_options')
    .upsert(unsynced.map((r) => ({ id: r.id, user_id: userId, name: r.name, sort_order: r.sortOrder })))
  if (error) throw new Error(`who_options: ${error.message}`)
  await Promise.all(unsynced.map((r) => db.whoOptions.update(r.id, { synced: true })))
}

async function pullWhoOptions(userId: string) {
  const { data, error } = await supabase.from('who_options').select('*').eq('user_id', userId)
  if (error) throw new Error(`who_options: ${error.message}`)
  if (!data?.length) return
  await db.whoOptions.bulkPut(data.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order, synced: true })))
}

// ---- recurring rules ----

async function pushRecurringRules(userId: string) {
  const unsynced = (await db.recurringRules.toArray()).filter((r) => r.synced !== true)
  if (unsynced.length === 0) return
  const { error } = await supabase.from('recurring_rules').upsert(
    unsynced.map((r) => ({
      id: r.id,
      user_id: userId,
      category_id: r.categoryId,
      subcategory_id: r.subcategoryId,
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      day_of_month: r.dayOfMonth,
      start_date: r.startDate,
      end_date: r.endDate,
      active: r.active,
      who_id: r.whoId,
      note: r.note,
    })),
  )
  if (error) throw new Error(`recurring_rules: ${error.message}`)
  await Promise.all(unsynced.map((r) => db.recurringRules.update(r.id, { synced: true })))
}

async function pullRecurringRules(userId: string) {
  const { data, error } = await supabase.from('recurring_rules').select('*').eq('user_id', userId)
  if (error) throw new Error(`recurring_rules: ${error.message}`)
  if (!data?.length) return
  await db.recurringRules.bulkPut(
    data.map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      subcategoryId: r.subcategory_id,
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      dayOfMonth: r.day_of_month,
      startDate: r.start_date,
      endDate: r.end_date,
      active: r.active,
      whoId: r.who_id,
      note: r.note,
      synced: true,
    })),
  )
}

// ---- transactions ----

async function pushTransactions(userId: string) {
  const unsynced = (await db.transactions.toArray()).filter((r) => r.synced !== true)
  if (unsynced.length === 0) return
  const { error } = await supabase.from('transactions').upsert(
    unsynced.map((r) => ({
      id: r.id,
      user_id: userId,
      date: r.date,
      type: r.type,
      currency: r.currency,
      total_amount: r.totalAmount,
      note: r.note,
      trip_id: r.tripId,
      recurring_rule_id: r.recurringRuleId,
      who_id: r.whoId,
      created_at: new Date(r.createdAt).toISOString(),
      updated_at: new Date(r.updatedAt).toISOString(),
    })),
  )
  if (error) throw new Error(`transactions: ${error.message}`)
  await Promise.all(unsynced.map((r) => db.transactions.update(r.id, { synced: true })))
}

async function pullTransactions(userId: string) {
  const { data, error } = await supabase.from('transactions').select('*').eq('user_id', userId)
  if (error) throw new Error(`transactions: ${error.message}`)
  if (!data?.length) return
  await db.transactions.bulkPut(
    data.map((r) => ({
      id: r.id,
      date: r.date,
      type: r.type,
      currency: r.currency,
      totalAmount: r.total_amount,
      note: r.note,
      tripId: r.trip_id,
      recurringRuleId: r.recurring_rule_id,
      whoId: r.who_id,
      createdAt: new Date(r.created_at).getTime(),
      updatedAt: new Date(r.updated_at).getTime(),
      synced: true,
    })),
  )
}

// ---- transaction splits ----

async function pushTransactionSplits(userId: string) {
  const unsynced = (await db.transactionSplits.toArray()).filter((r) => r.synced !== true)
  if (unsynced.length === 0) return
  const { error } = await supabase.from('transaction_splits').upsert(
    unsynced.map((r) => ({
      id: r.id,
      user_id: userId,
      transaction_id: r.transactionId,
      category_id: r.categoryId,
      subcategory_id: r.subcategoryId,
      amount: r.amount,
    })),
  )
  if (error) throw new Error(`transaction_splits: ${error.message}`)
  await Promise.all(unsynced.map((r) => db.transactionSplits.update(r.id, { synced: true })))
}

async function pullTransactionSplits(userId: string) {
  const { data, error } = await supabase.from('transaction_splits').select('*').eq('user_id', userId)
  if (error) throw new Error(`transaction_splits: ${error.message}`)
  if (!data?.length) return
  await db.transactionSplits.bulkPut(
    data.map((r) => ({
      id: r.id,
      transactionId: r.transaction_id,
      categoryId: r.category_id,
      subcategoryId: r.subcategory_id,
      amount: r.amount,
      synced: true,
    })),
  )
}

// ---- user settings ----
// Only currency/theme are synced — pinHash is a per-device gate that must never
// leave the device, and name/age/location/recurringOnboardingDone don't have a
// column in the Supabase table yet, so they stay local-only for now too.

async function pushUserSettings(userId: string) {
  const row = await db.userSettings.get('default')
  if (!row || row.synced === true) return
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, currency_default: row.currencyDefault, theme: row.theme })
  if (error) throw new Error(`user_settings: ${error.message}`)
  await db.userSettings.update('default', { synced: true })
}

async function pullUserSettings(userId: string) {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`user_settings: ${error.message}`)
  if (!data) return
  const existing = await db.userSettings.get('default')
  await db.userSettings.put({
    ...(existing ?? { id: 'default', currencyDefault: data.currency_default, theme: data.theme }),
    id: 'default',
    currencyDefault: data.currency_default,
    theme: data.theme,
    synced: true,
  })
}
