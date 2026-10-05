import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_UNIT } from '../constants.ts'
import { isExpiringConcern } from '../lib/dates.ts'
import { rememberRecent, writeLastAdd } from '../lib/prefs.ts'
import { findBarcodeMatch, normalizeBarcode } from '../lib/barcode.ts'
import { clampQuantity, findNameMatch } from '../lib/query.ts'
import { sampleItems } from '../lib/sampleData.ts'
import { isLowStock } from '../lib/stock.ts'
import { deleteItem, loadItems, replaceAll, saveItem } from '../lib/storage.ts'
import { newId, normalizeItem } from '../lib/backup.ts'
import { visiblePantryItems } from '../lib/syncMerge.ts'
import type { ItemDraft, LastAddPrefs, PantryItem } from '../types.ts'

export function emptyDraft(prefs?: LastAddPrefs | null): ItemDraft {
  return {
    name: '',
    quantity: 1,
    unit: prefs?.unit || DEFAULT_UNIT,
    category: prefs?.category || '',
    expiryDate: '',
    notes: '',
    lowStockThreshold: null,
    barcode: '',
  }
}

export function draftFromItem(item: PantryItem): ItemDraft {
  return {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    expiryDate: item.expiryDate ?? '',
    notes: item.notes,
    lowStockThreshold: item.lowStockThreshold,
    barcode: item.barcode,
  }
}

function itemFromDraft(draft: ItemDraft, existing?: PantryItem): PantryItem {
  const now = Date.now()
  return {
    id: existing?.id ?? newId(),
    name: draft.name.trim(),
    quantity: clampQuantity(draft.quantity),
    unit: draft.unit || DEFAULT_UNIT,
    category: draft.category.trim(),
    expiryDate: draft.expiryDate || null,
    notes: draft.notes.trim(),
    lowStockThreshold: draft.lowStockThreshold,
    barcode: normalizeBarcode(draft.barcode),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

function rememberAdd(item: PantryItem): void {
  writeLastAdd({ unit: item.unit, category: item.category })
  rememberRecent({ name: item.name, unit: item.unit, category: item.category })
}

function setVisibleItems(raw: PantryItem[]): PantryItem[] {
  return visiblePantryItems(raw.map((row) => normalizeItem(row) ?? row))
}

export function usePantry() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<PantryItem[]>([])
  const onLocalChangeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const notifyLocalChange = useCallback(() => {
    onLocalChangeRef.current?.()
  }, [])

  useEffect(() => {
    let cancelled = false
    loadItems()
      .then((loaded) => {
        if (cancelled) return
        setItems(setVisibleItems(loaded))
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load pantry items.')
          setReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const upsert = useCallback(
    async (item: PantryItem) => {
      const next = { ...item, deleted: false }
      setItems((current) => {
        const exists = current.some((entry) => entry.id === next.id)
        return exists
          ? current.map((entry) => (entry.id === next.id ? next : entry))
          : [next, ...current]
      })
      await saveItem(next)
      notifyLocalChange()
    },
    [notifyLocalChange],
  )

  const addItem = useCallback(
    async (draft: ItemDraft) => {
      const barcodeMatch = findBarcodeMatch(itemsRef.current, draft.barcode)
      const match = barcodeMatch ?? findNameMatch(itemsRef.current, draft.name)
      if (match) {
        const addBy = clampQuantity(draft.quantity) || 1
        const item: PantryItem = {
          ...match,
          quantity: clampQuantity(match.quantity + addBy),
          barcode: match.barcode || normalizeBarcode(draft.barcode),
          updatedAt: Date.now(),
        }
        await upsert(item)
        rememberAdd(item)
        return { item, bumped: true as const, addedBy: addBy }
      }

      const item = itemFromDraft(draft)
      await upsert(item)
      rememberAdd(item)
      return { item, bumped: false as const, addedBy: item.quantity }
    },
    [upsert],
  )

  const updateItem = useCallback(
    async (id: string, draft: ItemDraft) => {
      const existing = itemsRef.current.find((item) => item.id === id)
      if (!existing) return
      const item = itemFromDraft(draft, existing)
      await upsert(item)
    },
    [upsert],
  )

  const removeItem = useCallback(
    async (id: string) => {
      setItems((current) => current.filter((item) => item.id !== id))
      await deleteItem(id)
      notifyLocalChange()
    },
    [notifyLocalChange],
  )

  const patchItem = useCallback(
    async (id: string, mutate: (item: PantryItem) => PantryItem) => {
      const existing = itemsRef.current.find((item) => item.id === id)
      if (!existing) return null
      const next = mutate(existing)
      setItems((current) => current.map((item) => (item.id === id ? next : item)))
      await saveItem(next)
      notifyLocalChange()
      return next
    },
    [notifyLocalChange],
  )

  const adjustQuantity = useCallback(
    async (id: string, delta: number) => {
      return patchItem(id, (existing) => ({
        ...existing,
        quantity: clampQuantity(existing.quantity + delta),
        updatedAt: Date.now(),
      }))
    },
    [patchItem],
  )

  const markEmpty = useCallback(
    async (id: string) => {
      return patchItem(id, (existing) => ({
        ...existing,
        quantity: 0,
        updatedAt: Date.now(),
      }))
    },
    [patchItem],
  )

  const restockRecent = useCallback(
    async (name: string, unit: string, category: string) => {
      const match = findNameMatch(itemsRef.current, name)
      if (match) {
        const item: PantryItem = {
          ...match,
          quantity: clampQuantity(match.quantity + 1),
          updatedAt: Date.now(),
        }
        await upsert(item)
        rememberAdd(item)
        return { item, bumped: true as const, created: false as const }
      }
      const item = itemFromDraft({
        name,
        quantity: 1,
        unit: unit || DEFAULT_UNIT,
        category,
        expiryDate: '',
        notes: '',
        lowStockThreshold: null,
        barcode: '',
      })
      await upsert(item)
      rememberAdd(item)
      return { item, bumped: false as const, created: true as const }
    },
    [upsert],
  )

  const loadSamples = useCallback(async () => {
    const samples = sampleItems()
    setItems(samples)
    await replaceAll(samples)
    notifyLocalChange()
  }, [notifyLocalChange])

  const replaceItems = useCallback(
    async (next: PantryItem[]) => {
      const normalized = next.map((row) => normalizeItem(row) ?? row)
      setItems(setVisibleItems(normalized))
      await replaceAll(normalized)
      notifyLocalChange()
    },
    [notifyLocalChange],
  )

  const mergeItems = useCallback(
    async (incoming: PantryItem[]) => {
      const map = new Map(itemsRef.current.map((item) => [item.id, item]))
      for (const row of incoming) {
        const item = normalizeItem(row) ?? row
        map.set(item.id, item)
      }
      const merged = Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt)
      setItems(setVisibleItems(merged))
      await replaceAll(merged)
      notifyLocalChange()
    },
    [notifyLocalChange],
  )

  const setLocalChangeHandler = useCallback((handler: (() => void) | null) => {
    onLocalChangeRef.current = handler
  }, [])

  const refreshFromSync = useCallback(async (merged: PantryItem[]) => {
    setItems(setVisibleItems(merged))
  }, [])

  const stats = useMemo(
    () => ({
      total: items.length,
      empty: items.filter((item) => item.quantity <= 0).length,
      expiring: items.filter(isExpiringConcern).length,
      low: items.filter(isLowStock).length,
    }),
    [items],
  )

  return {
    items,
    ready,
    error,
    stats,
    addItem,
    updateItem,
    removeItem,
    adjustQuantity,
    markEmpty,
    restockRecent,
    loadSamples,
    replaceItems,
    mergeItems,
    setLocalChangeHandler,
    refreshFromSync,
  }
}
