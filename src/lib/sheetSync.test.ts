import { describe, expect, it } from 'vitest'
import { mergeLocalWithRemote } from './sheetSync.ts'
import type { SyncItem } from './syncMerge.ts'
import type { PantryItem } from '../types.ts'

function syncItem(partial: Partial<SyncItem> & { id: string; name: string }): SyncItem {
  const now = 1_000_000
  return {
    id: partial.id,
    name: partial.name,
    quantity: partial.quantity ?? 1,
    unit: partial.unit ?? 'pcs',
    category: partial.category ?? '',
    expiryDate: partial.expiryDate ?? null,
    notes: partial.notes ?? '',
    lowStockThreshold: partial.lowStockThreshold ?? null,
    barcode: partial.barcode ?? '',
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    deleted: partial.deleted ?? false,
  }
}

function pantry(partial: Partial<PantryItem> & { id: string; name: string }): PantryItem {
  const { deleted: _d, ...rest } = syncItem(partial)
  return { ...rest, ...(partial.deleted ? { deleted: true } : {}) }
}

describe('mergeLocalWithRemote (in-flight local edits)', () => {
  it('keeps local edits made during a slow sync when they are newer', () => {
    const postedLocal = [pantry({ id: 'a', name: 'At POST', updatedAt: 100 })]
    const serverResponse = [
      syncItem({ id: 'a', name: 'Server merged', updatedAt: 150 }),
    ]
    const freshLocal = [pantry({ id: 'a', name: 'Edited during flight', updatedAt: 300 })]

    expect(postedLocal[0].name).toBe('At POST')
    const merged = mergeLocalWithRemote(freshLocal, serverResponse)
    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe('Edited during flight')
    expect(merged[0].updatedAt).toBe(300)
  })
})
