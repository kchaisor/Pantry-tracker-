interface BottomActionBarProps {
  query: string
  onQuery: (value: string) => void
  itemCount: number
  onScan: () => void
  onAdd: () => void
}

export function BottomActionBar({ query, onQuery, itemCount, onScan, onAdd }: BottomActionBarProps) {
  return (
    <div className="studio-bottom-bar">
      <label className="studio-search">
        <span className="sr-only">Search items</span>
        <input
          type="search"
          placeholder={itemCount > 0 ? `Search ${itemCount} items…` : 'Search items…'}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
        />
      </label>
      <button type="button" className="studio-scan-btn" onClick={onScan}>
        <span className="scan-bars" aria-hidden="true">
          ||||
        </span>
        Scan
      </button>
      <button type="button" className="studio-add-btn" onClick={onAdd}>
        + Add
      </button>
    </div>
  )
}
