import { normalizeItem } from './backup.ts'
import {
  mergeSyncItems,
  pantryToSyncItem,
  parseSyncTimestamp,
  isDeletedFlag,
  type SyncItem,
} from './syncMerge.ts'
import type { PantryItem } from '../types.ts'

export const SYNC_URL_KEY = 'pantry.sheetSync.url'
export const SYNC_LAST_OK_KEY = 'pantry.sheetSync.lastOk'
export const SYNC_LAST_ERR_KEY = 'pantry.sheetSync.lastErr'

export interface SyncState {
  url: string | null
  lastSyncedAt: number | null
  lastError: string | null
}

export function readSyncState(): SyncState {
  let url: string | null = null
  let lastSyncedAt: number | null = null
  let lastError: string | null = null
  try {
    url = localStorage.getItem(SYNC_URL_KEY)
    const okRaw = localStorage.getItem(SYNC_LAST_OK_KEY)
    if (okRaw) {
      const n = Number(okRaw)
      if (Number.isFinite(n)) lastSyncedAt = n
    }
    lastError = localStorage.getItem(SYNC_LAST_ERR_KEY)
  } catch {
    /* private mode */
  }
  return { url, lastSyncedAt, lastError }
}

export function writeSyncUrl(url: string): void {
  try {
    localStorage.setItem(SYNC_URL_KEY, url.trim())
  } catch {
    /* ignore */
  }
}

function writeSyncOutcome(ok: boolean, error: string | null): void {
  try {
    if (ok) {
      localStorage.setItem(SYNC_LAST_OK_KEY, String(Date.now()))
      localStorage.removeItem(SYNC_LAST_ERR_KEY)
    } else {
      localStorage.setItem(SYNC_LAST_ERR_KEY, error ?? 'Sync failed')
    }
  } catch {
    /* ignore */
  }
}

export function normalizeSyncItem(raw: unknown): SyncItem | null {
  const base = normalizeItem(raw)
  if (!base) return null
  const row = raw as Record<string, unknown>
  return { ...base, deleted: isDeletedFlag(row.deleted) }
}

export function localItemsToSyncPayload(items: PantryItem[]): SyncItem[] {
  return items.map((item) =>
    pantryToSyncItem({
      ...item,
      deleted: Boolean((item as PantryItem & { deleted?: boolean }).deleted),
    }),
  )
}

export function applySyncResponse(local: PantryItem[], remoteItems: SyncItem[]): PantryItem[] {
  const localSync = localItemsToSyncPayload(local)
  const merged = mergeSyncItems(localSync, remoteItems)
  return merged.map((item) => {
    const { deleted, ...rest } = item
    return deleted ? ({ ...rest, deleted: true } as PantryItem & { deleted: boolean }) : rest
  })
}

export class SheetSyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SheetSyncError'
  }
}

async function parseSyncResponse(res: Response): Promise<SyncItem[]> {
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new SheetSyncError('Sync server returned invalid JSON')
  }
  if (!body || typeof body !== 'object') {
    throw new SheetSyncError('Sync server returned invalid JSON')
  }
  const record = body as { ok?: boolean; error?: string; items?: unknown }
  if (record.ok === false) {
    throw new SheetSyncError(record.error || 'Sync unauthorized or failed')
  }
  if (!Array.isArray(record.items)) {
    throw new SheetSyncError('Sync response missing items array')
  }
  return record.items
    .map((row) => normalizeSyncItem(row))
    .filter((item): item is SyncItem => item !== null)
}

/** POST all local items; server merges with sheet and returns full list. */
export async function syncWithSheet(
  syncUrl: string,
  localItems: PantryItem[],
): Promise<PantryItem[]> {
  const payload = JSON.stringify({ items: localItemsToSyncPayload(localItems) })

  let res: Response
  try {
    res = await fetch(syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: payload,
    })
  } catch {
    throw new SheetSyncError('Network error — could not reach sync server')
  }

  if (!res.ok) {
    throw new SheetSyncError(`Sync HTTP ${res.status}`)
  }

  const remoteItems = await parseSyncResponse(res)
  const merged = applySyncResponse(localItems, remoteItems)
  writeSyncOutcome(true, null)
  return merged
}

/** GET current sheet items (optional sanity / read-only). */
export async function fetchSheetItems(syncUrl: string): Promise<SyncItem[]> {
  let res: Response
  try {
    res = await fetch(syncUrl, { method: 'GET' })
  } catch {
    throw new SheetSyncError('Network error — could not reach sync server')
  }
  if (!res.ok) throw new SheetSyncError(`Sync HTTP ${res.status}`)
  return parseSyncResponse(res)
}

export function recordSyncError(message: string): void {
  writeSyncOutcome(false, message)
}

export { parseSyncTimestamp }
