export type Kind = 'income' | 'expense'

export interface Category {
  id: string
  name: string
  kind: Kind
  icon: string
  sortOrder: number
  createdAt: number
}

export interface Subcategory {
  id: string
  categoryId: string
  name: string
  icon: string | null
  sortOrder: number
}

export interface Trip {
  id: string
  name: string
  startDate: string
  endDate: string | null
  mergeIntoCategories: boolean
}

export interface WhoOption {
  id: string
  name: string
  sortOrder: number
}

export interface RecurringRule {
  id: string
  categoryId: string
  subcategoryId: string | null
  type: Kind
  amount: number
  currency: string
  dayOfMonth: number
  startDate: string
  endDate: string | null
  active: boolean
  whoId: string | null
  note: string | null
}

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD, day-precise
  type: Kind
  currency: string
  totalAmount: number
  note: string | null
  tripId: string | null
  recurringRuleId: string | null
  whoId: string | null
  createdAt: number
  updatedAt: number
}

export interface TransactionSplit {
  id: string
  transactionId: string
  categoryId: string
  subcategoryId: string | null
  amount: number
}

export interface UserSettings {
  id: 'default' // single local profile for now, one row
  currencyDefault: string
  theme: 'blue' | 'green'
}
