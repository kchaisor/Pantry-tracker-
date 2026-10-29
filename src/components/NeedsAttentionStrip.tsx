import { formatQuantity } from '../lib/query.ts'
import { unitLabel } from '../lib/units.ts'
import type { PantryItem } from '../types.ts'

interface NeedsAttentionStripProps {
  items: PantryItem[]
  onSelect: (id: string) => void
}

export function NeedsAttentionStrip({ items, onSelect }: NeedsAttentionStripProps) {
  if (items.length === 0) return null

  const shown = items.slice(0, 6)

  return (
    <div className="studio-urgency">
      <div className="studio-urgency-label">
        <span>Needs attention</span>
        <span>{items.length}</span>
      </div>
      <div className="studio-urgency-pills">
        {shown.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`u-pill ${item.quantity <= 0 ? 'low' : 'warn'}`}
            onClick={() => onSelect(item.id)}
          >
            {item.name.split('(')[0].trim()} · {formatQuantity(item.quantity)} {unitLabel(item.unit)}
          </button>
        ))}
      </div>
    </div>
  )
}
