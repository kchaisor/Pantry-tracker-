import { describe, expect, it } from 'vitest'
import { shelfLifeDaysForCategory, suggestedExpiryForCategory } from './categoryShelfLife.ts'

describe('category shelf life', () => {
  it('maps core categories', () => {
    expect(shelfLifeDaysForCategory('Dairy')).toBe(7)
    expect(shelfLifeDaysForCategory('Produce')).toBe(5)
    expect(shelfLifeDaysForCategory('Meat & seafood')).toBe(3)
    expect(shelfLifeDaysForCategory('Frozen')).toBe(90)
    expect(shelfLifeDaysForCategory('Condiments')).toBe(180)
    expect(shelfLifeDaysForCategory('Pantry')).toBe(365)
  })

  it('returns null for household-style categories', () => {
    expect(shelfLifeDaysForCategory('Household cleaning')).toBeNull()
    expect(suggestedExpiryForCategory('Laundry')).toBeNull()
  })

  it('builds ISO suggestion from fixed day', () => {
    expect(suggestedExpiryForCategory('Dairy', '2026-01-01')).toBe('2026-01-08')
  })
})
