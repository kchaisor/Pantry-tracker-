import type { StockFilter } from '../types.ts'
import type { PantryViewMode } from '../lib/viewPrefs.ts'

interface CompactTopBarProps {
  total: number
  syncLabel: string
  onSyncTap: () => void
  viewMode: PantryViewMode
  onViewMode: (mode: PantryViewMode) => void
  stock: StockFilter
  onStock: (value: StockFilter) => void
  category: string
  onCategory: (value: string) => void
  categories: string[]
  lowCount: number
  onOpenSettings: () => void
}

export function CompactTopBar({
  total,
  syncLabel,
  onSyncTap,
  viewMode,
  onViewMode,
  stock,
  onStock,
  category,
  onCategory,
  categories,
  lowCount,
  onOpenSettings,
}: CompactTopBarProps) {
  const statusFilters: { id: StockFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'low', label: lowCount > 0 ? `Low ${lowCount}` : 'Low' },
    { id: 'expiring', label: 'Expiring' },
  ]

  const toggleStock = (id: StockFilter) => {
    onStock(stock === id && id !== 'all' ? 'all' : id)
  }

  return (
    <header className="studio-top">
      <div className="studio-top-row">
        <div className="studio-title-block">
          <h1 className="studio-title">Pantry</h1>
          <button type="button" className="studio-sync-pill" onClick={onSyncTap}>
            {syncLabel || `Synced · ${total} items`}
          </button>
        </div>
        <div className="studio-top-actions">
          <div className="view-toggle" role="tablist" aria-label="View mode">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'cards'}
              className={viewMode === 'cards' ? 'is-on' : undefined}
              onClick={() => onViewMode('cards')}
            >
              Cards
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              className={viewMode === 'list' ? 'is-on' : undefined}
              onClick={() => onViewMode('list')}
            >
              List
            </button>
          </div>
          <button
            type="button"
            className="ghost-btn icon-btn studio-settings"
            onClick={onOpenSettings}
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.6.24-1.15.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.48.39 1.03.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.6-.24 1.15-.55 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="studio-filter-strip chips" role="tablist" aria-label="Filters">
        {statusFilters.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip studio-chip ${stock === option.id ? 'is-on' : ''} ${option.id === 'low' && lowCount > 0 && stock !== 'low' ? 'chip-alert' : ''}`}
            onClick={() => toggleStock(option.id)}
          >
            {option.label}
          </button>
        ))}
        <span className="chip-rule" aria-hidden="true" />
        {categories.slice(0, 8).map((name) => (
          <button
            key={name}
            type="button"
            className={`chip studio-chip ${category === name ? 'is-on' : ''}`}
            onClick={() => onCategory(category === name ? 'all' : name)}
          >
            {name}
          </button>
        ))}
      </div>
    </header>
  )
}
