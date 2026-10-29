import { useEffect, useMemo, useRef, useState } from 'react'
import { BarcodeScanner } from './components/BarcodeScanner.tsx'
import { BottomActionBar } from './components/BottomActionBar.tsx'
import { CompactListView } from './components/CompactListView.tsx'
import { CompactTopBar } from './components/CompactTopBar.tsx'
import { EmptyState } from './components/EmptyState.tsx'
import { InstallHint } from './components/InstallHint.tsx'
import { attentionItems, ItemCard } from './components/ItemCard.tsx'
import { ItemEditor } from './components/ItemEditor.tsx'
import { NeedsAttentionStrip } from './components/NeedsAttentionStrip.tsx'
import { PostScanSheet } from './components/PostScanSheet.tsx'
import { Settings } from './components/Settings.tsx'
import { Toast } from './components/Toast.tsx'
import { Welcome } from './components/Welcome.tsx'
import { CATEGORIES, INSTALL_HINT_KEY, WELCOME_KEY } from './constants.ts'
import { emptyDraft, usePantry } from './hooks/usePantry.ts'
import { useSheetSync } from './hooks/useSheetSync.ts'
import { maybeLocalNotify, syncAppBadge } from './lib/alerts.ts'
import { findBarcodeMatch } from './lib/barcode.ts'
import { parseScannedCode } from './lib/gs1Barcode.ts'
import { writePackSizeOverride } from './lib/packSize.ts'
import { applyLookupToDraft, lookupProduct, type ProductLookup } from './lib/productLookup.ts'
import { filterAndSort, formatQuantity, uniqueCategories } from './lib/query.ts'
import {
  readAlertPrefs,
  readLastAdd,
  readRecents,
  writeAlertPrefs,
} from './lib/prefs.ts'
import { isLowStock } from './lib/stock.ts'
import { applyTheme, isStandalone, readThemeMode } from './lib/theme.ts'
import { readViewMode, writeViewMode, type PantryViewMode } from './lib/viewPrefs.ts'
import type { AlertPrefs, ItemDraft, RecentItem, SortMode, StockFilter, ThemeMode } from './types.ts'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

interface PostScanState {
  draft: ItemDraft
  volumeMl: number | null
  lookupStatus: 'idle' | 'loading' | 'found' | 'miss'
  highlightExpiry: boolean
  gs1ExpiryApplied: boolean
  volumeMissingHint: boolean
}

export default function App() {
  const pantry = usePantry()
  const sheetSync = useSheetSync(pantry.refreshFromSync)

  const { setLocalChangeHandler } = pantry
  const { scheduleSync } = sheetSync

  useEffect(() => {
    setLocalChangeHandler(scheduleSync)
    return () => setLocalChangeHandler(null)
  }, [setLocalChangeHandler, scheduleSync])

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [stock, setStock] = useState<StockFilter>('all')
  const [sort] = useState<SortMode>('updated')
  const [viewMode, setViewMode] = useState<PantryViewMode>(() => readViewMode())
  const [themeMode] = useState<ThemeMode>(() => readThemeMode())
  const [editorId, setEditorId] = useState<string | 'new' | null>(null)
  const [editorSeed, setEditorSeed] = useState<ItemDraft | null>(null)
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'found' | 'miss'>('idle')
  const [scanHints, setScanHints] = useState({
    highlightExpiry: false,
    volumeMissingHint: false,
    gs1ExpiryApplied: false,
  })
  const [postScan, setPostScan] = useState<PostScanState | null>(null)
  const [incomingBarcode, setIncomingBarcode] = useState<string | null>(null)
  const [scannerMode, setScannerMode] = useState<'lookup' | 'attach' | 'expiry-ocr' | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => !readFlag(WELCOME_KEY))
  const [showInstallHint, setShowInstallHint] = useState(
    () => !readFlag(INSTALL_HINT_KEY) && !isStandalone(),
  )
  const [recents] = useState<RecentItem[]>(() => readRecents())
  const [lastAdd] = useState(() => readLastAdd())
  const [alertPrefs, setAlertPrefs] = useState<AlertPrefs>(() => readAlertPrefs())
  const [toast, setToast] = useState<string | null>(null)
  const scanDemoRan = useRef(false)
  const fixtureLoaded = useRef(false)
  const datePickRef = useRef<HTMLInputElement>(null)

  const lowItems = useMemo(() => attentionItems(pantry.items), [pantry.items])

  const syncLabel = useMemo(() => {
    const { url, lastSyncedAt, lastError } = sheetSync.syncState
    if (!url) return `Synced · ${pantry.stats.total} items`
    if (lastError) return 'Sync error · tap to fix'
    if (lastSyncedAt) return `Synced · ${pantry.stats.total} items`
    return `Sheet · ${pantry.stats.total} items`
  }, [sheetSync.syncState, pantry.stats.total])

  useEffect(() => {
    applyTheme(themeMode)
  }, [themeMode])

  useEffect(() => {
    if (!pantry.ready) return
    void syncAppBadge(lowItems.length)
  }, [pantry.ready, lowItems.length])

  useEffect(() => {
    if (!pantry.ready) return

    const ping = () => {
      void maybeLocalNotify(pantry.items, alertPrefs.notifyOnOpen)
    }

    ping()
    const onVis = () => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [pantry.ready, pantry.items, alertPrefs.notifyOnOpen])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!pantry.ready || fixtureLoaded.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('fixture') !== 'live') return
    fixtureLoaded.current = true
    void fetch(`${import.meta.env.BASE_URL}fixtures/pantry-live-items.json`)
      .then((res) => res.json())
      .then((body: { items?: unknown[] }) => {
        if (Array.isArray(body.items)) {
          void pantry.replaceItems(body.items as Parameters<typeof pantry.replaceItems>[0])
        }
      })
      .catch(() => {
        /* ignore */
      })
  }, [pantry.ready, pantry.replaceItems])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'list') {
      setViewMode('list')
      writeViewMode('list')
    }
  }, [])

  const categories = useMemo(
    () => uniqueCategories(pantry.items, CATEGORIES),
    [pantry.items],
  )

  const visible = useMemo(
    () => filterAndSort(pantry.items, query, category, stock, sort),
    [pantry.items, query, category, stock, sort],
  )

  const editingItem = editorId && editorId !== 'new'
    ? (pantry.items.find((item) => item.id === editorId) ?? null)
    : null

  const closeWelcome = () => {
    writeFlag(WELCOME_KEY)
    setShowWelcome(false)
  }

  const resetFilters = () => {
    setQuery('')
    setCategory('all')
    setStock('all')
  }

  const saveDraft = async (draft: ItemDraft) => {
    if (editorId && editorId !== 'new') {
      await pantry.updateItem(editorId, draft)
      return
    }
    const result = await pantry.addItem(draft)
    if (result.bumped) {
      setToast(
        `Added ${formatQuantity(result.addedBy)} to ${result.item.name} · now ${formatQuantity(result.item.quantity)} ${result.item.unit}`,
      )
    }
    resetFilters()
  }

  const onAdjust = async (id: string, delta: number) => {
    const before = pantry.items.find((item) => item.id === id)
    const after = await pantry.adjustQuantity(id, delta)
    if (before && after && !isLowStock(before) && isLowStock(after)) {
      setToast(`${after.name} is running low`)
    }
  }

  const onSetQuantity = async (id: string, quantity: number) => {
    const before = pantry.items.find((item) => item.id === id)
    const after = await pantry.setQuantity(id, quantity)
    if (before && after && !isLowStock(before) && isLowStock(after)) {
      setToast(`${after.name} is running low`)
    }
  }

  const closeEditor = () => {
    setEditorId(null)
    setEditorSeed(null)
    setLookupStatus('idle')
    setIncomingBarcode(null)
    setScanHints({ highlightExpiry: false, volumeMissingHint: false, gs1ExpiryApplied: false })
  }

  const openNew = (seed?: ItemDraft) => {
    setEditorSeed(seed ?? null)
    setLookupStatus('idle')
    setIncomingBarcode(null)
    setScanHints({ highlightExpiry: false, volumeMissingHint: false, gs1ExpiryApplied: false })
    setPostScan(null)
    setEditorId('new')
  }

  const openExisting = (id: string) => {
    setEditorSeed(null)
    setLookupStatus('idle')
    setIncomingBarcode(null)
    setEditorId(id)
  }

  const prefillFromLookup = async (code: string, seed: ItemDraft, gs1Expiry: boolean) => {
    setLookupStatus('loading')
    const found = await lookupProduct(code)
    const merged = found ? applyLookupToDraft(seed, found) : seed
    setPostScan((current) => {
      if (!current || current.draft.barcode !== code) return current
      return {
        ...current,
        draft: merged,
        volumeMl: found?.volumeMl ?? null,
        lookupStatus: found?.name ? 'found' : 'miss',
        volumeMissingHint: Boolean(found?.volumeUnknown),
        highlightExpiry: gs1Expiry ? false : !merged.expiryDate,
        gs1ExpiryApplied: gs1Expiry && Boolean(merged.expiryDate),
      }
    })
    setEditorSeed((current) => {
      if (!current || current.barcode !== code) return current
      if (!found) return current
      return applyLookupToDraft(current, found)
    })
    setScanHints((hints) => ({
      highlightExpiry: gs1Expiry ? false : hints.highlightExpiry || !seed.expiryDate,
      volumeMissingHint: Boolean(found?.volumeUnknown),
      gs1ExpiryApplied: gs1Expiry && Boolean(seed.expiryDate),
    }))
    setLookupStatus(found?.name ? 'found' : 'miss')
  }

  const openPostScan = (seed: ItemDraft, gs1Expiry: boolean) => {
    setPostScan({
      draft: seed,
      volumeMl: null,
      lookupStatus: 'idle',
      highlightExpiry: !gs1Expiry && !seed.expiryDate,
      gs1ExpiryApplied: gs1Expiry && Boolean(seed.expiryDate),
      volumeMissingHint: false,
    })
    setEditorSeed(seed)
  }

  const onScannedBarcode = async (raw: string) => {
    const parsed = parseScannedCode(raw)
    const code = parsed.barcode
    const mode = scannerMode
    setScannerMode(null)
    if (!code) return

    if (mode === 'attach') {
      setIncomingBarcode(code)
      return
    }

    if (mode === 'expiry-ocr') {
      setToast('OCR expiry: use full editor to confirm the scanned date.')
      return
    }

    const match = findBarcodeMatch(pantry.items, code)
    if (match) {
      const after = await pantry.adjustQuantity(match.id, 1)
      const nextQty = after?.quantity ?? match.quantity + 1
      if (match && after && !isLowStock(match) && isLowStock(after)) {
        setToast(`${after.name} is running low`)
      } else {
        setToast(
          `Added 1 to ${match.name} · now ${formatQuantity(nextQty)} ${match.unit}`,
        )
      }
      return
    }

    const seed: ItemDraft = {
      ...emptyDraft(lastAdd),
      barcode: code,
      expiryDate: parsed.expiryDate ?? '',
    }
    const gs1Expiry = Boolean(parsed.expiryDate)
    openPostScan(seed, gs1Expiry)
    await prefillFromLookup(code, seed, gs1Expiry)
  }

  const savePostScan = async (draft: ItemDraft, packSize: number | null) => {
    const result = await pantry.addItem(draft)
    if (packSize != null && packSize > 0) {
      writePackSizeOverride(result.item.id, packSize)
    }
    setPostScan(null)
    setToast(`Added ${result.item.name}`)
    resetFilters()
  }

  useEffect(() => {
    if (!pantry.ready || scanDemoRan.current) return
    const demo = new URLSearchParams(window.location.search).get('scanDemo')
    if (!demo) return
    scanDemoRan.current = true

    const run = async () => {
      if (demo === 'gs1-expiry') {
        await onScannedBarcode('(01)08410660098804(17)251231')
        return
      }
      if (demo === 'olive-oil' || demo === 'post-scan-sheet') {
        await onScannedBarcode('8410660098804')
        return
      }
      if (demo === 'volume-miss') {
        const code = '7935737788880'
        const seed: ItemDraft = { ...emptyDraft(lastAdd), barcode: code }
        openPostScan(seed, false)
        const stub: ProductLookup = {
          name: 'Fish sauce',
          brand: 'Three Crabs',
          category: 'Condiments',
          isLiquid: true,
          volumeMl: null,
          volumeUnknown: true,
        }
        const merged = applyLookupToDraft(seed, stub)
        setPostScan({
          draft: merged,
          volumeMl: null,
          lookupStatus: 'found',
          highlightExpiry: true,
          gs1ExpiryApplied: false,
          volumeMissingHint: true,
        })
        return
      }
    }
    void run()
  }, [pantry.ready, lastAdd])

  const filteredEmpty = pantry.items.length > 0 && visible.length === 0

  const onViewMode = (mode: PantryViewMode) => {
    setViewMode(mode)
    writeViewMode(mode)
  }

  const onSyncTap = () => {
    if (sheetSync.syncState.url) {
      void sheetSync.syncNow()
    } else {
      setShowSettings(true)
    }
  }

  return (
    <div className="app">
      <CompactTopBar
        total={pantry.stats.total}
        syncLabel={syncLabel}
        onSyncTap={onSyncTap}
        viewMode={viewMode}
        onViewMode={onViewMode}
        stock={stock}
        onStock={setStock}
        category={category}
        onCategory={setCategory}
        categories={categories}
        lowCount={pantry.stats.low}
        onOpenSettings={() => setShowSettings(true)}
      />

      {showInstallHint && !showWelcome ? (
        <InstallHint
          onDismiss={() => {
            writeFlag(INSTALL_HINT_KEY)
            setShowInstallHint(false)
          }}
        />
      ) : null}

      {!showWelcome && lowItems.length > 0 && stock === 'all' ? (
        <NeedsAttentionStrip items={lowItems} onSelect={openExisting} />
      ) : null}

      <main className="feed studio-feed">
        {!pantry.ready ? (
          <p className="loading">Opening pantry…</p>
        ) : pantry.error ? (
          <p className="form-error">{pantry.error}</p>
        ) : visible.length === 0 ? (
          <EmptyState
            filtered={filteredEmpty}
            onAdd={() => openNew()}
            onScan={() => setScannerMode('lookup')}
            onSample={() => void pantry.loadSamples()}
            onClearFilters={resetFilters}
          />
        ) : viewMode === 'list' ? (
          <CompactListView
            items={visible}
            onOpen={openExisting}
            onSetQuantity={(id, qty) => void onSetQuantity(id, qty)}
          />
        ) : (
          <ul className="item-list studio-cards">
            {visible.map((item) => (
              <li key={item.id}>
                <ItemCard
                  item={item}
                  onOpen={() => openExisting(item.id)}
                  onAdjust={(delta) => void onAdjust(item.id, delta)}
                  onSetQuantity={(qty) => void onSetQuantity(item.id, qty)}
                  onEmpty={() => void pantry.markEmpty(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {pantry.ready ? (
        <BottomActionBar
          query={query}
          onQuery={setQuery}
          itemCount={pantry.stats.total}
          onScan={() => setScannerMode('lookup')}
          onAdd={() => openNew()}
        />
      ) : null}

      <input
        ref={datePickRef}
        type="date"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          if (!postScan) return
          setPostScan({
            ...postScan,
            draft: { ...postScan.draft, expiryDate: event.target.value },
          })
        }}
      />

      {toast ? <Toast message={toast} /> : null}

      {postScan ? (
        <PostScanSheet
          draft={postScan.draft}
          lookupStatus={postScan.lookupStatus}
          volumeMl={postScan.volumeMl}
          highlightExpiry={postScan.highlightExpiry}
          gs1ExpiryApplied={postScan.gs1ExpiryApplied}
          onClose={() => setPostScan(null)}
          onSave={savePostScan}
          onMoreDetails={() => {
            openNew(postScan.draft)
            setLookupStatus(postScan.lookupStatus)
            setScanHints({
              highlightExpiry: postScan.highlightExpiry,
              volumeMissingHint: postScan.volumeMissingHint,
              gs1ExpiryApplied: postScan.gs1ExpiryApplied,
            })
            setPostScan(null)
          }}
          onPickDate={() => datePickRef.current?.showPicker?.() ?? datePickRef.current?.click()}
          onScanExpiryOcr={() => {
            setScannerMode('expiry-ocr')
            openNew(postScan.draft)
            setScanHints((h) => ({ ...h, highlightExpiry: true }))
            setPostScan(null)
          }}
        />
      ) : null}

      {editorId ? (
        <ItemEditor
          item={editingItem}
          items={pantry.items}
          recents={recents}
          extraCategories={categories}
          lastUnit={lastAdd?.unit}
          lastCategory={lastAdd?.category}
          initialDraft={editorSeed ?? undefined}
          incomingBarcode={incomingBarcode}
          lookupStatus={lookupStatus}
          highlightExpiry={scanHints.highlightExpiry}
          volumeMissingHint={scanHints.volumeMissingHint}
          gs1ExpiryApplied={scanHints.gs1ExpiryApplied}
          onDismissScanHints={() =>
            setScanHints((hints) => ({ ...hints, highlightExpiry: false }))
          }
          onScanBarcode={() => setScannerMode('attach')}
          onClose={closeEditor}
          onSave={saveDraft}
          onDelete={
            editingItem
              ? async () => {
                  await pantry.removeItem(editingItem.id)
                }
              : undefined
          }
        />
      ) : null}

      {scannerMode && scannerMode !== 'expiry-ocr' ? (
        <BarcodeScanner
          onClose={() => setScannerMode(null)}
          onDetect={(code) => void onScannedBarcode(code)}
        />
      ) : null}

      {showSettings ? (
        <Settings
          items={pantry.items}
          alertPrefs={alertPrefs}
          syncState={sheetSync.syncState}
          onSaveSyncUrl={sheetSync.saveSyncUrl}
          onSyncNow={() => void sheetSync.syncNow()}
          onAlertPrefs={(prefs) => {
            writeAlertPrefs(prefs)
            setAlertPrefs(prefs)
          }}
          onClose={() => setShowSettings(false)}
          onReplace={pantry.replaceItems}
          onMerge={pantry.mergeItems}
        />
      ) : null}

      {showWelcome ? (
        <Welcome onDismiss={closeWelcome} standalone={isStandalone()} />
      ) : null}
    </div>
  )
}
