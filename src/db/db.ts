import Dexie, { type EntityTable } from 'dexie'
import type {
  Category,
  RecurringRule,
  Subcategory,
  Transaction,
  TransactionSplit,
  Trip,
  UserSettings,
  WhoOption,
} from './types'

class FinanzasDB extends Dexie {
  categories!: EntityTable<Category, 'id'>
  subcategories!: EntityTable<Subcategory, 'id'>
  trips!: EntityTable<Trip, 'id'>
  whoOptions!: EntityTable<WhoOption, 'id'>
  recurringRules!: EntityTable<RecurringRule, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  transactionSplits!: EntityTable<TransactionSplit, 'id'>
  userSettings!: EntityTable<UserSettings, 'id'>

  constructor() {
    super('finanzas')
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
  }
}

export const db = new FinanzasDB()
