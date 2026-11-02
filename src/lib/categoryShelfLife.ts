import { addDaysIso } from './dates.ts'

/** Typical shelf life in days from today; null = no default expiry. */
export type CategoryShelfDays = number | null

const SHELF_BY_KEY: { match: (category: string) => boolean; days: CategoryShelfDays }[] = [
  { match: (c) => c === 'dairy' || c.includes('dairy'), days: 7 },
  { match: (c) => c === 'produce' || c.includes('produce'), days: 5 },
  {
    match: (c) => c.includes('meat') || c.includes('seafood') || c.includes('fish'),
    days: 3,
  },
  { match: (c) => c.includes('frozen') || c.includes('freezer'), days: 90 },
  { match: (c) => c.includes('condiment') || c.includes('sauce'), days: 180 },
  {
    match: (c) =>
      c.includes('household') ||
      c.includes('clean') ||
      c.includes('laundry') ||
      c.includes('detergent'),
    days: null,
  },
  {
    match: (c) =>
      c.includes('pantry') ||
      c.includes('canned') ||
      c.includes('dry') ||
      c.includes('bread') ||
      c.includes('snack') ||
      c.includes('breakfast') ||
      c.includes('spice') ||
      c.includes('beverage') ||
      c === 'other',
    days: 365,
  },
]

export function shelfLifeDaysForCategory(category: string): CategoryShelfDays {
  const c = category.trim().toLowerCase()
  if (!c) return null
  for (const row of SHELF_BY_KEY) {
    if (row.match(c)) return row.days
  }
  return 365
}

export function suggestedExpiryForCategory(category: string, from?: string): string | null {
  const days = shelfLifeDaysForCategory(category)
  if (days == null) return null
  return addDaysIso(days, from)
}
