import { useEffect, useMemo, useRef, useState } from 'react'
import { BarcodeScanner } from './components/BarcodeScanner.tsx'
import { EmptyState } from './components/EmptyState.tsx'
import { Header } from './components/Header.tsx'
import { InstallHint } from './components/InstallHint.tsx'
import { ItemCard } from './components/ItemCard.tsx'
import { ItemEditor } from './components/ItemEditor.tsx'
import { LowStockBanner } from './components/LowStockBanner.tsx'
import { QuickAdd } from './components/QuickAdd.tsx'
import { Settings } from './components/Settings.tsx'
import { Toast } from './components/Toast.tsx'
import { Toolbar } from './components/Toolbar.tsx'
import { Welcome } from './components/Welcome.tsx'
import { CATEGORIES, DEFAULT_UNIT, INSTALL_HINT_KEY, WELCOME_KEY } from './constants.ts'
import { emptyDraft, usePantry } from './hooks/usePantry.ts'
import { useSheetSync } from './hooks/useSheetSync.ts'
import { maybeLocalNotify, syncAppBadge } from './lib/alerts.ts'
import { findBarcodeMatch } from './lib/barcode.ts'
import { parseScannedCode } from './lib/gs1Barcode.ts'
import { applyLookupToDraft, lookupProduct, type ProductLookup } from './lib/productLookup.ts'
import { filterAndSort, formatQuantity, uniqueCategories } from './lib/query.ts'
import {
  dismissBanner,
  isBannerDismissed,
  readAlertPrefs,
  readLastAdd,
  readRecents,
  writeAlertPrefs,
} from './lib/prefs.ts'
import { isLowStock, lowStockItems, lowStockKey } from './lib/stock.ts'
import { applyTheme, isStandalone, readThemeMode } from './lib/theme.ts'
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
  const [sort, setSort] = useState<SortMode>('updated')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemeMode())
  const [editorId, setEditorId] = useState<string | 'new' | null>(null)
  const [editorSeed, setEditorSeed] = useState<ItemDraft | null>(null)
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'found' | 'miss'>('idle')
  const [scanHints, setScanHints] = useState({
    highlightExpiry: false,
    volumeMissingHint: false,
    gs1ExpiryApplied: false,
  })
  const [incomingBarcode, setIncomingBarcode] = useState<string | null>(null)
  const [scannerMode, setScannerMode] = useState<'lookup' | 'attach' | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => !readFlag(WELCOME_KEY))
  const [showInstallHint, setShowInstallHint] = useState(
    () => !readFlag(INSTALL_HINT_KEY) && !isStandalone(),
  )
  const [recents, setRecents] = useState<RecentItem[]>(() => readRecents())
  const [lastAdd, setLastAdd] = useState(() => readLastAdd())
  const [alertPrefs, setAlertPrefs] = useState<AlertPrefs>(() => readAlertPrefs())
  const [bannerHiddenKey, setBannerHiddenKey] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const scanDemoRan = useRef(false)

  const lowItems = useMemo(() => lowStockItems(pantry.items), [pantry.items])
  const bannerKey = useMemo(() => lowStockKey(pantry.items), [pantry.items])

  useEffect(() => {
    applyTheme(themeMode)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (themeMode === 'system') applyTheme('system')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
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

  const cycleTheme = () => {
    const order: ThemeMode[] = ['system', 'light', 'dark']
    const next = order[(order.indexOf(themeMode) + 1) % order.length]
    setThemeMode(next)
  }

  const closeWelcome = () => {
    writeFlag(WELCOME_KEY)
    setShowWelcome(false)
  }

  const resetFilters = () => {
    setQuery('')
    setCategory('all')
    setStock('all')
    setSort('updated')
  }

  const refreshLocals = () => {
    setRecents(readRecents())
    setLastAdd(readLastAdd())
  }

  const saveDraft = async (draft: ItemDraft) => {
    if (editorId && editorId !== 'new') {
      await pantry.updateItem(editorId, draft)
      return
    }
    const result = await pantry.addItem(draft)
    refreshLocals()
    if (result.bumped) {
      setToast(
        `Added ${formatQuantity(result.addedBy)} to ${result.item.name} · now ${formatQuantity(result.item.quantity)} ${result.item.unit}`,
      )
    }
    resetFilters()
  }

  const quickAddName = async (name: string) => {
    const result = await pantry.addItem({
      name,
      brand: '',
      quantity: 1,
      unit: lastAdd?.unit || DEFAULT_UNIT,
      category: lastAdd?.category || '',
      expiryDate: '',
      notes: '',
      lowStockThreshold: null,
      barcode: '',
    })
    refreshLocals()
    if (result.bumped) {
      setToast(
        `Added 1 to ${result.item.name} · now ${formatQuantity(result.item.quantity)} ${result.item.unit}`,
      )
    } else {
      setToast(`Added ${result.item.name}`)
    }
  }

  const addRecent = async (recent: RecentItem) => {
    const result = await pantry.restockRecent(recent.name, recent.unit, recent.category)
    refreshLocals()
    if (result.bumped) {
      setToast(
        `Added 1 to ${result.item.name} · now ${formatQuantity(result.item.quantity)} ${result.item.unit}`,
      )
    } else {
      setToast(`Added ${result.item.name}`)
    }
  }

  const onAdjust = async (id: string, delta: number) => {
    const before = pantry.items.find((item) => item.id === id)
    const after = await pantry.adjustQuantity(id, delta)
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
    openNew(seed)
    setScanHints({
      highlightExpiry: !gs1Expiry,
      volumeMissingHint: false,
      gs1ExpiryApplied: gs1Expiry,
    })
    await prefillFromLookup(code, seed, gs1Expiry)
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
      if (demo === 'olive-oil') {
        await onScannedBarcode('8410660098804')
        return
      }
      if (demo === 'volume-miss') {
        const code = '7935737788880'
        const seed: ItemDraft = { ...emptyDraft(lastAdd), barcode: code }
        openNew(seed)
        const stub: ProductLookup = {
          name: 'Fish sauce',
          brand: 'Three Crabs',
          category: 'Condiments',
          isLiquid: true,
          volumeMl: null,
          volumeUnknown: true,
        }
        setEditorSeed(applyLookupToDraft(seed, stub))
        setScanHints({
          highlightExpiry: true,
          volumeMissingHint: true,
          gs1ExpiryApplied: false,
        })
        setLookupStatus('found')
        return
      }
    }
    void run()
  }, [pantry.ready, lastAdd])

  const filteredEmpty = pantry.items.length > 0 && visible.length === 0
  const showQuickAdd = pantry.ready && !pantry.error && (pantry.items.length > 0 || recents.length > 0)
  const showLowBanner =
    pantry.ready &&
    !showWelcome &&
    lowItems.length > 0 &&
    bannerHiddenKey !== bannerKey &&
    !isBannerDismissed(bannerKey)

  return (
    <div className="app">
      <Header
        themeMode={themeMode}
        onCycleTheme={cycleTheme}
        onOpenSettings={() => setShowSettings(true)}
        onScan={() => setScannerMode('lookup')}
        total={pantry.stats.total}
        expiring={pantry.stats.expiring}
        empty={pantry.stats.empty}
        low={pantry.stats.low}
      />

      <Toolbar
        query={query}
        onQuery={setQuery}
        category={category}
        onCategory={setCategory}
        categories={categories}
        stock={stock}
        onStock={setStock}
        sort={sort}
        onSort={setSort}
        lowCount={pantry.stats.low}
      />

      {showInstallHint && !showWelcome ? (
        <InstallHint
          onDismiss={() => {
            writeFlag(INSTALL_HINT_KEY)
            setShowInstallHint(false)
          }}
        />
      ) : null}

      {showLowBanner ? (
        <LowStockBanner
          items={lowItems}
          onShow={() => {
            setStock('low')
            setCategory('all')
            setQuery('')
            dismissBanner(bannerKey)
            setBannerHiddenKey(bannerKey)
          }}
          onDismiss={() => {
            dismissBanner(bannerKey)
            setBannerHiddenKey(bannerKey)
          }}
        />
      ) : null}

      {showQuickAdd ? (
        <QuickAdd
          recents={recents}
          busy={!pantry.ready}
          onAdd={quickAddName}
          onRecent={addRecent}
          onScan={() => setScannerMode('lookup')}
        />
      ) : null}

      <main className="feed">
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
        ) : (
          <ul className="item-list">
            {visible.map((item) => (
              <li key={item.id}>
                <ItemCard
                  item={item}
                  onOpen={() => openExisting(item.id)}
                  onAdjust={(delta) => void onAdjust(item.id, delta)}
                  onEmpty={() => void pantry.markEmpty(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {pantry.ready ? (
        <button
          type="button"
          className="fab"
          aria-label="Add pantry item"
          onClick={() => openNew()}
        >
          +
        </button>
      ) : null}

      {toast ? <Toast message={toast} /> : null}

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

      {scannerMode ? (
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
