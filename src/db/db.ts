import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  Category,
  PendingDelete,
  RecurringRule,
  Subcategory,
  Transaction,
  TransactionSplit,
  Trip,
  UserSettings,
  WhoOption,
} from './types'

// Auto-stamps `synced: false` on any ordinary create/update to a syncable table.
// The sync engine (db/sync.ts) is the only code that ever sets `synced: true`, and
// it does so by including that field explicitly in its own writes — which these
// hooks are written to respect rather than override. Loosely typed (any) rather
// than generic over each table's real row type — Dexie's hook() overloads don't
// resolve cleanly through a generic `Table<T>` parameter, and every syncable row
// shape here already carries an optional `synced?: boolean` field regardless.
function registerSyncHooks(table: Table<any, any>) {
  table.hook('creating', (_primKey: unknown, obj: any) => {
    if (obj.synced === undefined) obj.synced = false
  })
  table.hook('updating', (modifications: any) => {
    if (!('synced' in modifications)) return { synced: false }
    return undefined
  })
}

class FinanzasDB extends Dexie {
  categories!: EntityTable<Category, 'id'>
  subcategories!: EntityTable<Subcategory, 'id'>
  trips!: EntityTable<Trip, 'id'>
  whoOptions!: EntityTable<WhoOption, 'id'>
  recurringRules!: EntityTable<RecurringRule, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  transactionSplits!: EntityTable<TransactionSplit, 'id'>
  userSettings!: EntityTable<UserSettings, 'id'>
  // Rows deleted locally that still need their matching remote row deleted on
  // Supabase — see the three delete functions in db/repo.ts and db/sync.ts.
  pendingDeletes!: EntityTable<PendingDelete, 'id'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      categories: 'id, kind, sortOrder, name',
      subcategories: 'id, categoryId, sortOrder, name',
      trips: 'id, startDate',
      whoOptions: 'id, sortOrder',
      recurringRules: 'id, categoryId, active',
      transactions: 'id, date, type, tripId, whoId, recurringRuleId',
      transactionSplits: 'id, transactionId, categoryId, subcategoryId',
      userSettings: 'id',
    })
    // Purely additive — a new table, and `synced` isn't an indexed field on any
    // existing one, so this needs no upgrade() migration of existing rows.
    this.version(2).stores({
      categories: 'id, kind, sortOrder, name',
      subcategories: 'id, categoryId, sortOrder, name',
      trips: 'id, startDate',
      whoOptions: 'id, sortOrder',
      recurringRules: 'id, categoryId, active',
      transactions: 'id, date, type, tripId, whoId, recurringRuleId',
      transactionSplits: 'id, transactionId, categoryId, subcategoryId',
      userSettings: 'id',
      pendingDeletes: '++id, table, rowId',
    })

    registerSyncHooks(this.categories)
    registerSyncHooks(this.subcategories)
    registerSyncHooks(this.trips)
    registerSyncHooks(this.whoOptions)
    registerSyncHooks(this.recurringRules)
    registerSyncHooks(this.transactions)
    registerSyncHooks(this.transactionSplits)
    registerSyncHooks(this.userSettings)
  }
}

// The fixed name every install used before accounts existed — every one of Pablo's
// real transactions today lives under this name. Once accounts are live it's only
// ever opened for the one-time claim flow (see db/authRepo.ts), never as the live
// database for a logged-in user.
export const LEGACY_DB_NAME = 'finanzas'

// `db` is a live binding, not a frozen value — every file that does
// `import { db } from '../db/db'` reads whatever it currently points to, so
// switchDatabaseFor() below can swap it for a different person's database and
// every existing `db.categories`/`db.transactions`/etc. call elsewhere in the app
// picks that up automatically, with no per-file changes needed. This only works
// safely because the app that actually reads `db` (SwipeableTabs and everything
// under it) is never mounted until AuthProvider has already resolved which
// database it should be — see AuthProvider's phase machine.
export let db = new FinanzasDB(LEGACY_DB_NAME)

// Called once a Supabase session resolves to a user id — points every `db.*` call
// elsewhere in the app at that person's own local database from then on, instead
// of filtering every row by a userId column. Two different people logging into the
// same device this way can never have their data cross-contaminate, even for a
// split second before anything syncs.
export function switchDatabaseFor(userId: string): FinanzasDB {
  const name = `finanzas-${userId}`
  if (db.name === name) return db
  db.close()
  db = new FinanzasDB(name)
  return db
}

// A throwaway handle onto the legacy pre-accounts database, used only by the claim
// flow to read (and, once claimed, delete) it — never assigned to the shared `db`.
export function openLegacyDatabase(): FinanzasDB {
  return new FinanzasDB(LEGACY_DB_NAME)
}
