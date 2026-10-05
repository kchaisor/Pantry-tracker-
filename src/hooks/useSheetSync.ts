import { useCallback, useEffect, useRef, useState } from 'react'
import {
  readSyncState,
  recordSyncError,
  syncWithSheet,
  writeSyncUrl,
  type SyncState,
} from '../lib/sheetSync.ts'
import { loadItems, replaceAll } from '../lib/storage.ts'
import { visiblePantryItems } from '../lib/syncMerge.ts'
import type { PantryItem } from '../types.ts'

const DEBOUNCE_MS = 1500
const PERIODIC_MS = 60_000

export function useSheetSync(onSynced: (items: PantryItem[]) => Promise<void>) {
  const [syncState, setSyncState] = useState<SyncState>(() => readSyncState())
  const syncingRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const onSyncedRef = useRef(onSynced)

  useEffect(() => {
    onSyncedRef.current = onSynced
  }, [onSynced])

  const runSync = useCallback(async () => {
    const { url } = readSyncState()
    if (!url) return
    if (syncingRef.current) return
    syncingRef.current = true
    try {
      const local = await loadItems()
      const merged = await syncWithSheet(url, local)
      await replaceAll(merged)
      await onSyncedRef.current(visiblePantryItems(merged))
      setSyncState(readSyncState())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      recordSyncError(message)
      setSyncState(readSyncState())
    } finally {
      syncingRef.current = false
    }
  }, [])

  const scheduleSync = useCallback(() => {
    const { url } = readSyncState()
    if (!url) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      void runSync()
    }, DEBOUNCE_MS)
  }, [runSync])

  const saveUrl = useCallback(
    (url: string) => {
      writeSyncUrl(url)
      setSyncState(readSyncState())
      void runSync()
    },
    [runSync],
  )

  useEffect(() => {
    const { url } = readSyncState()
    if (!url) return

    void runSync()

    const onOnline = () => void runSync()
    const onVis = () => {
      if (document.visibilityState === 'visible') void runSync()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVis)
    const interval = window.setInterval(() => void runSync(), PERIODIC_MS)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(interval)
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [runSync])

  return {
    syncState,
    saveSyncUrl: saveUrl,
    syncNow: runSync,
    scheduleSync,
    syncing: syncingRef,
  }
}
