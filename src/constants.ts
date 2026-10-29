import type { Category, Unit } from './types.ts'

export const APP_NAME = 'Pantry'
export const DB_NAME = 'pantry-tracker'
export const DB_VERSION = 1
export const STORE_NAME = 'items'
export const THEME_KEY = 'pantry.theme'
export const WELCOME_KEY = 'pantry.welcome.seen'
export const INSTALL_HINT_KEY = 'pantry.installHint.dismissed'
export const LAST_ADD_KEY = 'pantry.lastAdd'
export const RECENTS_KEY = 'pantry.recents'
export const ALERT_PREFS_KEY = 'pantry.alertPrefs'
export const BANNER_DISMISS_KEY = 'pantry.lowBanner'
export const VIEW_MODE_KEY = 'pantry.viewMode'
export const NOTIFY_DAY_KEY = 'pantry.notify.day'
export const SOON_DAYS = 3
export const MAX_RECENTS = 8

/** Used when an item has no per-item threshold. Quantity at or below this (and above 0) is “low”. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 1

export const UNITS: readonly Unit[] = [
  'pcs',
  'oz',
  'lb',
  'g',
  'kg',
  'ml',
  'L',
  'cup',
  'can',
  'box',
  'bag',
  'bottle',
  'jar',
  'pack',
]

export const CATEGORIES: readonly Category[] = [
  'Produce',
  'Dairy',
  'Meat & seafood',
  'Bread',
  'Pantry',
  'Canned',
  'Frozen',
  'Beverages',
  'Snacks',
  'Breakfast',
  'Condiments',
  'Spices',
  'Other',
]

export const DEFAULT_UNIT: Unit = 'pcs'
