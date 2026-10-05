import { describe, expect, it } from 'vitest'
import { mergeSyncItems, type SyncItem } from './syncMerge.ts'

function item(partial: Partial<SyncItem> & { id: string; name: string }): SyncItem {
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

describe('mergeSyncItems', () => {
  it('keeps newer updatedAt from either side', () => {
    const local = [item({ id: 'a', name: 'Local', updatedAt: 100 })]
    const remote = [item({ id: 'a', name: 'Remote', updatedAt: 200 })]
    const merged = mergeSyncItems(local, remote)
    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe('Remote')

    const merged2 = mergeSyncItems(remote, local)
    expect(merged2[0].name).toBe('Remote')
  })

  it('applies tombstones when newer', () => {
    const live = [item({ id: 'a', name: 'Milk', updatedAt: 100, deleted: false })]
    const tomb = [item({ id: 'a', name: 'Milk', updatedAt: 150, deleted: true })]
    const merged = mergeSyncItems(live, tomb)
    expect(merged[0].deleted).toBe(true)
  })

  it('seeds local-only ids into union (first sync)', () => {
    const local = [
      item({ id: 'phone-1', name: 'Rice', updatedAt: 50 }),
      item({ id: 'phone-2', name: 'Beans', updatedAt: 60 }),
    ]
    const merged = mergeSyncItems(local, [])
    expect(merged.map((i) => i.id).sort()).toEqual(['phone-1', 'phone-2'])
  })

  it('does not drop sheet-only ids when merging', () => {
    const local = [item({ id: 'a', name: 'A', updatedAt: 10 })]
    const remote = [item({ id: 'b', name: 'B', updatedAt: 20 })]
    const merged = mergeSyncItems(local, remote)
    expect(merged.map((i) => i.id).sort()).toEqual(['a', 'b'])
  })
})
