import { expiryLabel, itemTone } from '../lib/dates.ts'
import { formatQuantity } from '../lib/query.ts'
import { unitLabel } from '../lib/units.ts'
import { effectiveThreshold } from '../lib/stock.ts'
import type { PantryItem } from '../types.ts'

interface ItemCardProps {
  item: PantryItem
  onOpen: () => void
  onAdjust: (delta: number) => void
  onEmpty: () => void
}

const TONE_COPY: Record<string, string> = {
  empty: 'Out of stock',
  expired: 'Expired',
  soon: 'Use soon',
  low: 'Low',
}

export function ItemCard({ item, onOpen, onAdjust, onEmpty }: ItemCardProps) {
  const tone = itemTone(item)
  const expiry = expiryLabel(item.expiryDate)
  const threshold = effectiveThreshold(item)

  return (
    <article className={`card tone-${tone}`}>
      <button type="button" className="card-main" onClick={onOpen}>
        <div className="card-copy">
          <h2>{item.name}</h2>
          <p className="card-subline">
            {item.brand ? <span className="card-brand">{item.brand}</span> : null}
            {item.brand ? ' · ' : ''}
            {item.category || 'Uncategorized'}
            {expiry ? ` · ${expiry}` : ''}
            {tone === 'low' && threshold > 0 ? ` · alert at ${threshold}` : ''}
          </p>
          {item.notes ? <p className="card-notes">{item.notes}</p> : null}
        </div>
        {tone !== 'ok' ? <span className={`pill pill-${tone}`}>{TONE_COPY[tone]}</span> : null}
      </button>

      <div className="card-actions">
        <div className="stepper">
          <button
            type="button"
            className="stepper-btn"
            aria-label={`Decrease ${item.name}`}
            onClick={() => onAdjust(-1)}
            disabled={item.quantity <= 0}
          >
            −
          </button>
          <span className="stepper-value">
            {formatQuantity(item.quantity)}
            <small>{unitLabel(item.unit)}</small>
          </span>
          <button
            type="button"
            className="stepper-btn"
            aria-label={`Increase ${item.name}`}
            onClick={() => onAdjust(1)}
          >
            +
          </button>
        </div>
        {item.quantity > 0 ? (
          <button type="button" className="text-btn" onClick={onEmpty}>
            Mark empty
          </button>
        ) : (
          <button type="button" className="text-btn" onClick={() => onAdjust(1)}>
            Restock
          </button>
        )}
      </div>
    </article>
  )
}
