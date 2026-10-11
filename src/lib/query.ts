import { barcodeSearchHaystack } from './barcode.ts'
import { isExpiringConcern } from './dates.ts'
import { isLowStock } from './stock.ts'
import type { PantryItem, SortMode, StockFilter } from '../types.ts'

export function uniqueBrands(items: PantryItem[]): string[] {
  const brands = new Set(
    items.map((item) => item.brand.trim()).filter((brand) => brand.length > 0),
  )
  return Array.from(brands).sort((a, b) => a.localeCompare(b))
}

export function uniqueCategories(items: PantryItem[], defaults: readonly string[]): string[] {
  const used = new Set(
    items.map((item) => item.category.trim()).filter((category) => category.length > 0),
  )
  const extras = Array.from(used)
    .filter((category) => !defaults.includes(category))
    .sort((a, b) => a.localeCompare(b))
  const usedStarters = defaults.filter((category) => used.has(category))
  const unusedStarters = defaults.filter((category) => !used.has(category))
  return [...usedStarters, ...unusedStarters, ...extras]
}

export function filterAndSort(
  items: PantryItem[],
  query: string,
  category: string,
  stock: StockFilter,
  sort: SortMode,
): PantryItem[] {
  const needle = query.trim().toLowerCase()

  const filtered = items.filter((item) => {
    if (
      needle &&
      !item.name.toLowerCase().includes(needle) &&
      !(item.brand || '').toLowerCase().includes(needle) &&
      !barcodeSearchHaystack(item.barcode).includes(needle.replace(/[\s-]/g, ''))
    ) {
      return false
    }
    if (category !== 'all' && item.category !== category) return false
    if (stock === 'empty' && item.quantity > 0) return false
    if (stock === 'expiring' && !isExpiringConcern(item)) return false
    if (stock === 'low' && !isLowStock(item)) return false
    return true
  })

  const ranked = [...filtered]
  ranked.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    if (sort === 'updated') return b.updatedAt - a.updatedAt
    const aExpiry = a.expiryDate ?? '9999-12-31'
    const bExpiry = b.expiryDate ?? '9999-12-31'
    if (aExpiry !== bExpiry) return aExpiry.localeCompare(bExpiry)
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
  return ranked
}

export function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) return String(quantity)
  return String(Math.round(quantity * 100) / 100)
}

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value * 100) / 100)
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function findNameMatch(items: PantryItem[], name: string): PantryItem | undefined {
  const needle = normalizeName(name)
  if (!needle) return undefined
  const matches = items.filter((item) => normalizeName(item.name) === needle)
  matches.sort((a, b) => b.updatedAt - a.updatedAt)
  return matches[0]
}
