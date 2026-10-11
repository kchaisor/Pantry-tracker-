import { addDaysIso } from './dates.ts'
import { normalizeItem } from './backup.ts'
import type { PantryItem } from '../types.ts'

function item(
  partial: Omit<PantryItem, 'id' | 'createdAt' | 'updatedAt' | 'lowStockThreshold' | 'barcode' | 'brand'> & {
    id: string
    brand?: string
    daysAgo?: number
    lowStockThreshold?: number | null
    barcode?: string
  },
): PantryItem {
  const updatedAt = Date.now() - (partial.daysAgo ?? 0) * 86_400_000
  return {
    id: partial.id,
    name: partial.name,
    brand: partial.brand ?? '',
    quantity: partial.quantity,
    unit: partial.unit,
    category: partial.category,
    expiryDate: partial.expiryDate,
    notes: partial.notes,
    lowStockThreshold: partial.lowStockThreshold ?? null,
    barcode: partial.barcode ?? '',
    createdAt: updatedAt,
    updatedAt,
  }
}

export function sampleItems(): PantryItem[] {
  const samples = [
    item({
      id: 'sample-milk',
      name: 'Whole milk',
      quantity: 1,
      unit: 'L',
      category: 'Dairy',
      expiryDate: addDaysIso(2),
      notes: 'Opened yesterday',
      daysAgo: 1,
    }),
    item({
      id: 'sample-spinach',
      name: 'Baby spinach',
      quantity: 1,
      unit: 'bag',
      category: 'Produce',
      expiryDate: addDaysIso(1),
      notes: '',
    }),
    item({
      id: 'sample-eggs',
      name: 'Eggs',
      quantity: 8,
      unit: 'pcs',
      category: 'Dairy',
      expiryDate: addDaysIso(10),
      notes: '',
      daysAgo: 3,
      lowStockThreshold: 12,
    }),
    item({
      id: 'sample-oil',
      name: 'Olive oil',
      quantity: 1,
      unit: 'bottle',
      category: 'Pantry',
      expiryDate: null,
      notes: 'Extra virgin',
      daysAgo: 12,
    }),
    item({
      id: 'sample-chicken',
      name: 'Chicken thighs',
      quantity: 0,
      unit: 'lb',
      category: 'Meat & seafood',
      expiryDate: null,
      notes: 'Restock this week',
      daysAgo: 2,
    }),
    item({
      id: 'sample-berries',
      name: 'Frozen blueberries',
      quantity: 2,
      unit: 'bag',
      category: 'Frozen',
      expiryDate: addDaysIso(80),
      notes: '',
      daysAgo: 8,
    }),
    item({
      id: 'sample-bread',
      name: 'Sourdough',
      quantity: 1,
      unit: 'pcs',
      category: 'Bread',
      expiryDate: addDaysIso(-1),
      notes: '',
    }),
    item({
      id: 'sample-soy',
      name: 'Soy sauce',
      quantity: 1,
      unit: 'bottle',
      category: 'Condiments',
      expiryDate: null,
      notes: '',
      daysAgo: 20,
      lowStockThreshold: 0,
    }),
    item({
      id: 'sample-oats',
      name: 'Rolled oats',
      quantity: 1,
      unit: 'box',
      category: 'Breakfast',
      expiryDate: null,
      notes: '',
      daysAgo: 6,
      lowStockThreshold: 1,
    }),
  ]
  return samples.map((entry) => normalizeItem(entry) ?? entry)
}
