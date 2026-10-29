import { expiryLabel, itemTone } from '../lib/dates.ts'
import {
  FRACTION_LABELS,
  FRACTION_STEPS,
  fillGaugeColor,
  fillPercent,
  inferPackSize,
  isContinuousUnit,
  nearestFraction,
  type FillFraction,
} from '../lib/packSize.ts'
import { formatQuantity } from '../lib/query.ts'
import { effectiveThreshold, isLowStock } from '../lib/stock.ts'
import { unitLabel } from '../lib/units.ts'
import type { PantryItem } from '../types.ts'

interface ItemCardProps {
  item: PantryItem
  onOpen: () => void
  onAdjust: (delta: number) => void
  onSetQuantity: (quantity: number) => void
  onEmpty: () => void
}

const TONE_COPY: Record<string, string> = {
  empty: 'Out',
  expired: 'Expired',
  soon: 'Use soon',
  low: 'Low',
}

export function ItemCard({ item, onOpen, onAdjust, onSetQuantity, onEmpty }: ItemCardProps) {
  const tone = itemTone(item)
  const expiry = expiryLabel(item.expiryDate)
  const threshold = effectiveThreshold(item)
  const continuous = isContinuousUnit(item.unit)
  const packSize = continuous ? inferPackSize(item) : 0
  const activeFrac = continuous ? nearestFraction(item.quantity, packSize) : null

  const brandLine = [item.brand, item.category].filter(Boolean).join(' · ').toUpperCase()

  return (
    <article className={`studio-card tone-${tone} ${tone === 'low' ? 'is-low' : ''}`}>
      <button type="button" className="studio-card-head" onClick={onOpen}>
        <div className="studio-card-copy">
          {brandLine ? <p className="studio-brand">{brandLine}</p> : null}
          <h2 className="studio-item-name">{item.name}</h2>
        </div>
        <div className="studio-card-meta">
          <span className="studio-qty-badge">
            {formatQuantity(item.quantity)}
            {continuous && packSize > 0 ? (
              <>
                {' '}
                / {formatQuantity(packSize)} {unitLabel(item.unit)}
              </>
            ) : (
              <> {unitLabel(item.unit)}</>
            )}
          </span>
          {tone !== 'ok' ? (
            <span className={`studio-status pill-${tone}`}>{TONE_COPY[tone]}</span>
          ) : continuous && packSize > 0 ? (
            <span className="studio-status studio-status-muted">
              {fillPercent(item.quantity, packSize)}% · {FRACTION_LABELS[activeFrac ?? 0]}
            </span>
          ) : null}
          {expiry ? <span className="studio-expiry-hint">{expiry}</span> : null}
          {tone === 'low' && threshold > 0 ? (
            <span className="studio-expiry-hint">Low (&lt;{threshold} {unitLabel(item.unit)})</span>
          ) : null}
        </div>
      </button>

      {continuous && packSize > 0 ? (
        <>
          <div className="studio-gauge-row">
            <div className="studio-bar-bg">
              <div
                className="studio-bar-fill"
                style={{
                  width: `${Math.max(2, fillPercent(item.quantity, packSize))}%`,
                  background: fillGaugeColor(item.quantity, packSize, tone),
                }}
              />
            </div>
          </div>
          <div className="studio-frac-pills" role="group" aria-label="Set fill level">
            {FRACTION_STEPS.map((frac) => (
              <button
                key={frac}
                type="button"
                className={`studio-frac ${activeFrac === frac ? (tone === 'low' && frac > 0 ? 'low-on' : 'on') : ''}`}
                onClick={() => onSetQuantity(frac === 0 ? 0 : Math.round(packSize * frac * 100) / 100)}
              >
                {FRACTION_LABELS[frac as FillFraction]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="studio-discrete-actions">
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
            <button type="button" className="stepper-value stepper-tap" onClick={onOpen}>
              {formatQuantity(item.quantity)}
              <small>{unitLabel(item.unit)}</small>
            </button>
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
              Out
            </button>
          ) : (
            <button type="button" className="text-btn" onClick={() => onAdjust(1)}>
              Restock
            </button>
          )}
        </div>
      )}
    </article>
  )
}

export function attentionItems(items: PantryItem[]): PantryItem[] {
  return items.filter((item) => {
    if (item.quantity <= 0) return true
    if (isLowStock(item)) return true
    const tone = itemTone(item)
    return tone === 'soon' || tone === 'expired'
  })
}
