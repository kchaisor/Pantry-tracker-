import { useEffect, useId, useState } from 'react'
import { addDaysIso } from '../lib/dates.ts'
import {
  EXPIRY_PRESETS,
  expiryPresetDays,
  mapCategoryToZone,
  ZONE_PRESETS,
  type ZonePreset,
} from '../lib/postScanPresets.ts'
import {
  FRACTION_STEPS,
  inferPackSize,
  packSizeFromVolumeMl,
  quantityForFraction,
  type FillFraction,
} from '../lib/packSize.ts'
import { formatQuantity } from '../lib/query.ts'
import { unitLabel } from '../lib/units.ts'
import type { ItemDraft } from '../types.ts'
import { ProductThumb } from './ProductThumb.tsx'

interface PostScanSheetProps {
  draft: ItemDraft
  lookupStatus: 'idle' | 'loading' | 'found' | 'miss'
  volumeMl: number | null
  imageUrl?: string | null
  highlightExpiry?: boolean
  gs1ExpiryApplied?: boolean
  onClose: () => void
  onSave: (draft: ItemDraft, packSize: number | null) => Promise<void>
  onMoreDetails: () => void
  onPickDate: () => void
  onScanExpiryOcr: () => void
}

const FILL_LABELS: Record<FillFraction, string> = {
  1: '100% Full',
  0.75: '¾',
  0.5: '½',
  0.25: '¼',
  0: 'Out',
}

export function PostScanSheet({
  draft,
  lookupStatus,
  volumeMl,
  imageUrl,
  highlightExpiry,
  gs1ExpiryApplied,
  onClose,
  onSave,
  onMoreDetails,
  onPickDate,
  onScanExpiryOcr,
}: PostScanSheetProps) {
  const titleId = useId()
  const [zone, setZone] = useState<ZonePreset>(() => mapCategoryToZone(draft.category))
  const [fill, setFill] = useState<FillFraction>(1)
  const [expiry, setExpiry] = useState(draft.expiryDate)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setExpiry(draft.expiryDate)
  }, [draft.expiryDate])

  const unit = draft.unit || 'ml'
  const packSize =
    volumeMl != null && volumeMl > 0
      ? packSizeFromVolumeMl(volumeMl, unit)
      : inferPackSize({
          id: 'draft',
          name: draft.name,
          brand: draft.brand,
          quantity: draft.quantity,
          unit,
          category: draft.category,
          expiryDate: draft.expiryDate || null,
          notes: draft.notes,
          lowStockThreshold: draft.lowStockThreshold,
          barcode: draft.barcode,
          createdAt: 0,
          updatedAt: 0,
        })

  const displayVolume =
    volumeMl != null && volumeMl > 0
      ? `${formatQuantity(packSizeFromVolumeMl(volumeMl, unit))} ${unitLabel(unit)}`
      : null

  const submit = async () => {
    setBusy(true)
    try {
      const quantity = quantityForFraction(packSize, fill)
      await onSave(
        {
          ...draft,
          category: zone,
          quantity,
          unit,
          expiryDate: expiry,
        },
        packSize > 0 ? packSize : null,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <section className="sheet post-scan-sheet">
        <header className="post-scan-head">
          <button type="button" className="text-btn" onClick={onClose}>
            Cancel
          </button>
          <h2 id={titleId}>Add to pantry</h2>
          <span className="post-scan-spacer" />
        </header>

        <div className="post-scan-product">
          <ProductThumb
            item={{
              id: 'draft',
              name: draft.name,
              barcode: draft.barcode,
              unit: draft.unit,
              category: draft.category,
            }}
            imageUrl={imageUrl}
            size="lg"
            className="post-scan-thumb"
          />
          <div className="post-scan-product-copy">
            <p className="post-scan-brand">
              {draft.brand || (lookupStatus === 'loading' ? '' : 'Scanned product')}
            </p>
            <h3>{draft.name.trim() || (lookupStatus === 'loading' ? 'Looking up…' : 'Unknown product')}</h3>
            {displayVolume ? <p className="post-scan-volume">{displayVolume}</p> : null}
          </div>
        </div>

        <div className="post-scan-section">
          <p className="post-scan-label">Zone</p>
          <div className="chips wrap">
            {ZONE_PRESETS.map((z) => (
              <button
                key={z}
                type="button"
                className={`chip ${zone === z ? 'is-on' : ''}`}
                onClick={() => setZone(z)}
              >
                {z}
              </button>
            ))}
          </div>
        </div>

        <div className="post-scan-section">
          <p className="post-scan-label">Initial fill</p>
          <div className="chips wrap">
            {FRACTION_STEPS.filter((f) => f > 0).map((f) => (
              <button
                key={f}
                type="button"
                className={`chip ${fill === f ? 'is-on' : ''}`}
                onClick={() => setFill(f)}
              >
                {FILL_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="post-scan-section">
          <p className="post-scan-label">Expiry</p>
          {gs1ExpiryApplied && expiry ? (
            <p className="form-hint">From GS1 barcode: {expiry}</p>
          ) : null}
          {highlightExpiry && !expiry ? (
            <p className="form-hint">Pick a preset or scan the date on pack.</p>
          ) : null}
          <div className="chips wrap">
            {EXPIRY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`chip ${preset.id === 'none' && !expiry ? 'is-on' : ''}`}
                onClick={() => setExpiry(expiryPresetDays(preset.id))}
              >
                {preset.label}
              </button>
            ))}
            <button type="button" className="chip" onClick={onScanExpiryOcr}>
              📷 Scan Date (OCR)
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => {
                onPickDate()
              }}
            >
              Pick date…
            </button>
          </div>
          {expiry ? <p className="form-hint">Expires {expiry}</p> : null}
        </div>

        <button type="button" className="primary-btn post-scan-save" disabled={busy || !draft.name.trim()} onClick={() => void submit()}>
          Save to Pantry (1 Tap)
        </button>

        <button type="button" className="text-btn post-scan-more" onClick={onMoreDetails}>
          More details (category, threshold, notes…)
        </button>
      </section>
    </div>
  )
}

/** Hidden date input helper for pick-date flow from parent. */
export function hiddenDateDefault(): string {
  return addDaysIso(30)
}
