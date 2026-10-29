import { daysUntil, itemTone } from '../lib/dates.ts'
import {
  fillPercent,
  fractionStatusLabel,
  inferPackSize,
  isContinuousUnit,
  nextFractionQuantity,
} from '../lib/packSize.ts'
import { formatQuantity } from '../lib/query.ts'
import { isLowStock } from '../lib/stock.ts'
import { unitLabel } from '../lib/units.ts'
import type { PantryItem } from '../types.ts'

interface CompactListViewProps {
  items: PantryItem[]
  onOpen: (id: string) => void
  onSetQuantity: (id: string, quantity: number) => void
}

function groupLabel(category: string): string {
  const c = category.trim() || 'Uncategorized'
  return c.toUpperCase()
}

export function CompactListView({ items, onOpen, onSetQuantity }: CompactListViewProps) {
  const groups = new Map<string, PantryItem[]>()
  for (const item of items) {
    const key = groupLabel(item.category)
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }

  const orderedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b))

  return (
    <div className="studio-list">
      {orderedKeys.map((key) => (
        <section key={key} className="studio-list-group">
          <h3 className="studio-list-heading">{key}</h3>
          <ul>
            {(groups.get(key) ?? []).map((item) => {
              const tone = itemTone(item)
              const continuous = isContinuousUnit(item.unit)
              const packSize = continuous ? inferPackSize(item) : 0
              const low = isLowStock(item)
              const expiryDays = item.expiryDate ? daysUntil(item.expiryDate) : null

              return (
                <li key={item.id}>
                  <button type="button" className="studio-list-row" onClick={() => onOpen(item.id)}>
                    <span className="studio-list-name">{item.name}</span>
                    <span className="studio-list-qty">
                      {formatQuantity(item.quantity)} {unitLabel(item.unit)}
                    </span>
                    {continuous && packSize > 0 ? (
                      <button
                        type="button"
                        className={`studio-list-pill tone-${tone}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onSetQuantity(item.id, nextFractionQuantity(item.quantity, packSize))
                        }}
                      >
                        {fractionStatusLabel(item.quantity, packSize, low)}
                      </button>
                    ) : (
                      <span className={`studio-list-pill tone-${tone}`}>
                        {item.quantity <= 0 ? 'OUT' : low ? 'LOW' : `${formatQuantity(item.quantity)}`}
                      </span>
                    )}
                    {expiryDays != null && expiryDays >= 0 && expiryDays <= 120 ? (
                      <span className="studio-list-expiry">{expiryDays}d</span>
                    ) : continuous && packSize > 0 ? (
                      <span className="studio-list-expiry muted">{fillPercent(item.quantity, packSize)}%</span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
