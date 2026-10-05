export type Unit =
  | 'pcs'
  | 'oz'
  | 'lb'
  | 'g'
  | 'kg'
  | 'ml'
  | 'L'
  | 'cup'
  | 'can'
  | 'box'
  | 'bag'
  | 'bottle'
  | 'jar'
  | 'pack'

export type Category =
  | 'Produce'
  | 'Dairy'
  | 'Meat & seafood'
  | 'Bread'
  | 'Pantry'
  | 'Canned'
  | 'Frozen'
  | 'Beverages'
  | 'Snacks'
  | 'Breakfast'
  | 'Condiments'
  | 'Spices'
  | 'Other'

export type SortMode = 'name' | 'expiry' | 'updated'
export type StockFilter = 'all' | 'expiring' | 'empty' | 'low'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface PantryItem {
  id: string
  name: string
  quantity: number
  unit: string
  category: string
  expiryDate: string | null
  notes: string
  /** When null, the app uses DEFAULT_LOW_STOCK_THRESHOLD (1). 0 disables the low badge. */
  lowStockThreshold: number | null
  /** Normalized UPC/EAN when known; empty string otherwise. */
  barcode: string
  createdAt: number
  updatedAt: number
  /** Tombstone for sheet sync; hidden in UI when true. */
  deleted?: boolean
}

export interface ItemDraft {
  name: string
  quantity: number
  unit: string
  category: string
  expiryDate: string
  notes: string
  lowStockThreshold: number | null
  barcode: string
}

export type ItemTone = 'ok' | 'soon' | 'expired' | 'empty' | 'low'

export interface RecentItem {
  name: string
  unit: string
  category: string
}

export interface LastAddPrefs {
  unit: string
  category: string
}

export interface AlertPrefs {
  notifyOnOpen: boolean
}

export interface BackupFile {
  app: 'pantry'
  version: 1
  exportedAt: string
  items: PantryItem[]
}
