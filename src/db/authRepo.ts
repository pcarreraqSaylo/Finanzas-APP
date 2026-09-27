import Dexie from 'dexie'
import { db, LEGACY_DB_NAME, openLegacyDatabase } from './db'

// Whether the pre-accounts local database exists on this device and actually has
// something in it — used to decide whether a brand-new login should even offer the
// claim choice at all (a genuinely new person, e.g. Pablo's mom on her own phone,
// has no legacy database and skips straight past this).
export async function hasLegacyData(): Promise<boolean> {
  if (!(await Dexie.exists(LEGACY_DB_NAME))) return false
  const legacy = openLegacyDatabase()
  try {
    return (await legacy.categories.count()) > 0
  } finally {
    legacy.close()
  }
}

// Copies every row from the old single-profile database into the current (per-user)
// database, then deletes the old one — run once, only when a user explicitly chooses
// to claim pre-existing local data on their very first login (see AuthProvider).
// The legacy database is only deleted after every table has copied successfully;
// if anything throws, it's left untouched so the claim can simply be retried.
export async function claimLegacyData(): Promise<void> {
  const legacy = openLegacyDatabase()
  try {
    const [categories, subcategories, trips, whoOptions, recurringRules, transactions, transactionSplits, userSettings] =
      await Promise.all([
        legacy.categories.toArray(),
        legacy.subcategories.toArray(),
        legacy.trips.toArray(),
        legacy.whoOptions.toArray(),
        legacy.recurringRules.toArray(),
        legacy.transactions.toArray(),
        legacy.transactionSplits.toArray(),
        legacy.userSettings.toArray(),
      ])

    await db.transaction(
      'rw',
      [db.categories, db.subcategories, db.trips, db.whoOptions, db.recurringRules, db.transactions, db.transactionSplits, db.userSettings],
      async () => {
        if (categories.length) await db.categories.bulkPut(categories)
        if (subcategories.length) await db.subcategories.bulkPut(subcategories)
        if (trips.length) await db.trips.bulkPut(trips)
        if (whoOptions.length) await db.whoOptions.bulkPut(whoOptions)
        if (recurringRules.length) await db.recurringRules.bulkPut(recurringRules)
        if (transactions.length) await db.transactions.bulkPut(transactions)
        if (transactionSplits.length) await db.transactionSplits.bulkPut(transactionSplits)
        if (userSettings.length) await db.userSettings.bulkPut(userSettings)
      },
    )
  } finally {
    legacy.close()
  }
  await Dexie.delete(LEGACY_DB_NAME)
}
