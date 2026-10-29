import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  FRACTION_STEPS,
  inferPackSize,
  isContinuousUnit,
  isDiscreteUnit,
  nextFractionQuantity,
  parsePackSizeFromText,
  quantityForFraction,
  fillPercent,
  nearestFraction,
  PACK_SIZE_OVERRIDES_KEY,
  writePackSizeOverride,
} from './packSize.ts'
import type { PantryItem } from '../types.ts'

function item(partial: Partial<PantryItem> & Pick<PantryItem, 'name' | 'quantity' | 'unit'>): PantryItem {
  return {
    id: partial.id ?? 'test-id',
    brand: partial.brand ?? '',
    category: partial.category ?? '',
    expiryDate: partial.expiryDate ?? null,
    notes: partial.notes ?? '',
    lowStockThreshold: partial.lowStockThreshold ?? null,
    barcode: partial.barcode ?? '',
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? 0,
    ...partial,
  }
}

const lsStore: Record<string, string> = {}

beforeEach(() => {
  delete lsStore[PACK_SIZE_OVERRIDES_KEY]
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => lsStore[key] ?? null,
    setItem: (key: string, value: string) => {
      lsStore[key] = value
    },
    removeItem: (key: string) => {
      delete lsStore[key]
    },
  })
})

describe('isContinuousUnit', () => {
  it('detects mass/volume units', () => {
    expect(isContinuousUnit('mL')).toBe(true)
    expect(isContinuousUnit('ml')).toBe(true)
    expect(isContinuousUnit('L')).toBe(true)
    expect(isContinuousUnit('g')).toBe(true)
    expect(isContinuousUnit('kg')).toBe(true)
  })

  it('treats bottles and packs as discrete', () => {
    expect(isDiscreteUnit('bottle')).toBe(true)
    expect(isDiscreteUnit('pack')).toBe(true)
    expect(isContinuousUnit('bottle')).toBe(false)
  })
})

describe('parsePackSizeFromText', () => {
  it('parses mL from notes', () => {
    expect(parsePackSizeFromText('682 mL bottle, nearly empty', 'mL')).toBe(682)
  })

  it('parses liters into mL pack size', () => {
    expect(parsePackSizeFromText('1 L; Amazon', 'ml')).toBe(1000)
  })

  it('parses kg for kg unit', () => {
    expect(parsePackSizeFromText('2 kg box', 'kg')).toBe(2)
  })
})

describe('inferPackSize', () => {
  it('uses notes volume before fallback', () => {
    const fish = item({
      name: 'Fish Sauce',
      quantity: 50,
      unit: 'mL',
      notes: '682 mL bottle',
      lowStockThreshold: 200,
    })
    expect(inferPackSize(fish)).toBe(682)
  })

  it('respects local override', () => {
    writePackSizeOverride('abc', 750)
    const row = item({ id: 'abc', name: 'Oil', quantity: 200, unit: 'mL', notes: '' })
    expect(inferPackSize(row)).toBe(750)
  })

  it('falls back to max(quantity, threshold*4, 500)', () => {
    const row = item({ name: 'Mystery', quantity: 120, unit: 'mL', lowStockThreshold: 50, notes: '' })
    expect(inferPackSize(row)).toBe(Math.max(120, 200, 500))
  })
})

describe('fraction pills', () => {
  it('maps fractions to quantities', () => {
    expect(quantityForFraction(1000, 1)).toBe(1000)
    expect(quantityForFraction(1000, 0.75)).toBe(750)
    expect(quantityForFraction(1000, 0.5)).toBe(500)
    expect(quantityForFraction(1000, 0.25)).toBe(250)
    expect(quantityForFraction(1000, 0)).toBe(0)
  })

  it('cycles through fraction steps in list view', () => {
    const pack = 682
    let qty = quantityForFraction(pack, 1)
    expect(nearestFraction(qty, pack)).toBe(1)
    qty = nextFractionQuantity(qty, pack)
    expect(qty).toBe(quantityForFraction(pack, 0.75))
    qty = nextFractionQuantity(qty, pack)
    expect(qty).toBe(quantityForFraction(pack, 0.5))
    qty = nextFractionQuantity(qty, pack)
    expect(qty).toBe(quantityForFraction(pack, 0.25))
    qty = nextFractionQuantity(qty, pack)
    expect(qty).toBe(0)
    qty = nextFractionQuantity(qty, pack)
    expect(qty).toBe(pack)
  })

  it('computes fill percent', () => {
    expect(fillPercent(50, 682)).toBe(7)
    expect(fillPercent(341, 682)).toBe(50)
  })

  it('covers all fraction steps', () => {
    expect(FRACTION_STEPS.length).toBe(5)
  })
})
