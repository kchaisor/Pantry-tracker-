import type { PantryItem } from '../types.ts'

/** Item shape for Google Sheet sync (includes tombstone flag). */
export type SyncItem = PantryItem & { deleted: boolean }

export function parseSyncTimestamp(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

export function isDeletedFlag(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase()
    return s === 'true' || s === '1' || s === 'yes'
  }
  return false
}

/** Last-write-wins merge by id; union of both sides (never drops ids present on either side). */
export function mergeSyncItems(a: SyncItem[], b: SyncItem[]): SyncItem[] {
  const map = new Map<string, SyncItem>()

  const consider = (item: SyncItem) => {
    const id = item.id.trim()
    if (!id) return
    const existing = map.get(id)
    if (!existing) {
      map.set(id, item)
      return
    }
    const aTs = parseSyncTimestamp(existing.updatedAt)
    const bTs = parseSyncTimestamp(item.updatedAt)
    if (bTs > aTs) map.set(id, item)
    else if (bTs === aTs) {
      // Prefer tombstone when timestamps tie (delete wins over stale revive).
      if (item.deleted && !existing.deleted) map.set(id, item)
    }
  }

  for (const item of a) consider(item)
  for (const item of b) consider(item)

  return Array.from(map.values())
}

export function pantryToSyncItem(item: PantryItem): SyncItem {
  return {
    ...item,
    deleted: Boolean((item as PantryItem & { deleted?: boolean }).deleted),
  }
}

export function syncItemToPantry(item: SyncItem): PantryItem {
  const { deleted: _d, ...rest } = item
  return rest
}

export function visiblePantryItems(items: PantryItem[]): PantryItem[] {
  return items.filter((item) => !(item as PantryItem & { deleted?: boolean }).deleted)
}
