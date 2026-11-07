import { useEffect, useId, useRef, useState } from 'react'
import { suggestedExpiryForCategory } from '../lib/categoryShelfLife.ts'
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
import { runExpiryOcrOnFile } from '../lib/runExpiryOcr.ts'
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
  onMoreDetails: (draft: ItemDraft) => void
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
}: PostScanSheetProps) {
  const titleId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [zone, setZone] = useState<ZonePreset>(() => mapCategoryToZone(draft.category))
  const [fill, setFill] = useState<FillFraction>(1)
  const [expiry, setExpiry] = useState(draft.expiryDate)
  const [expirySuggested, setExpirySuggested] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrPick, setOcrPick] = useState<{ best: string; alternatives: string[] } | null>(null)
  const [ocrNotice, setOcrNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setExpiry(draft.expiryDate)
    if (gs1ExpiryApplied && draft.expiryDate) {
      setExpirySuggested(false)
    }
  }, [draft.expiryDate, gs1ExpiryApplied])

  useEffect(() => {
    if (gs1ExpiryApplied) return
    if (draft.expiryDate && !expirySuggested) return
    const cat = draft.category.trim()
    if (!cat) return
    const next = suggestedExpiryForCategory(cat)
    if (next && next !== expiry) {
      setExpiry(next)
      setExpirySuggested(true)
    } else if (!next && expirySuggested) {
      setExpiry('')
      setExpirySuggested(false)
    }
  }, [draft.category, draft.expiryDate, expiry, expirySuggested, gs1ExpiryApplied])

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

  const applyExpiry = (iso: string, suggested = false) => {
    setExpiry(iso)
    setExpirySuggested(suggested)
    setOcrPick(null)
    setOcrNotice(null)
  }

  const onPhotoSelected = async (file: File | undefined) => {
    if (!file) return
    setOcrBusy(true)
    setOcrNotice(null)
    setOcrPick(null)
    try {
      const result = await runExpiryOcrOnFile(file)
      if (result.status === 'error') {
        setOcrNotice(result.message)
        return
      }
      if (result.status === 'empty') {
        setOcrNotice('No date found on the photo — try a closer shot of the expiry line.')
        return
      }
      setOcrPick({ best: result.best, alternatives: result.alternatives })
    } finally {
      setOcrBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

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

  const showSuggested = expirySuggested && expiry && !gs1ExpiryApplied

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

        <div
          className={`post-scan-section expiry-block ${highlightExpiry ? 'expiry-block--scan' : ''} ${showSuggested ? 'expiry-block--suggested' : ''}`}
        >
          <p className="post-scan-label">Expiry</p>
          {gs1ExpiryApplied && expiry ? (
            <p className="form-hint">From GS1 barcode: {expiry}</p>
          ) : showSuggested ? (
            <p className="form-hint expiry-suggest-hint">
              Suggested {expiry} from category — change, tap a chip, or scan the pack.
            </p>
          ) : highlightExpiry && !expiry ? (
            <p className="form-hint">Pick a preset, photo, or calendar date.</p>
          ) : expiry ? (
            <p className="form-hint">Expires {expiry}</p>
          ) : null}
          <div className="chips wrap expiry-quick-chips">
            {EXPIRY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`chip expiry-chip ${preset.id === 'clear' && !expiry ? 'is-on' : ''}`}
                onClick={() => applyExpiry(expiryPresetDays(preset.id), false)}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className="chip expiry-chip"
              disabled={ocrBusy}
              onClick={() => fileRef.current?.click()}
            >
              {ocrBusy ? 'Reading…' : 'Photo'}
            </button>
            <label className="chip expiry-chip expiry-date-chip">
              {expiry || 'Pick date…'}
              <input
                type="date"
                className="expiry-native-date"
                value={expiry}
                aria-label="Pick expiry date"
                onChange={(event) => applyExpiry(event.target.value, false)}
              />
            </label>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void onPhotoSelected(event.target.files?.[0])}
          />
          {ocrNotice ? <p className="form-hint">{ocrNotice}</p> : null}
          {ocrPick ? (
            <div className="expiry-ocr-confirm" role="group" aria-label="Confirm scanned expiry">
              <p className="form-hint">Found on pack — confirm before saving:</p>
              <div className="chips wrap">
                <button type="button" className="chip is-on" onClick={() => applyExpiry(ocrPick.best, false)}>
                  {ocrPick.best}
                </button>
                {ocrPick.alternatives.map((alt) => (
                  <button key={alt} type="button" className="chip" onClick={() => applyExpiry(alt, false)}>
                    {alt}
                  </button>
                ))}
                <button type="button" className="chip" onClick={() => setOcrPick(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <button type="button" className="primary-btn post-scan-save" disabled={busy || !draft.name.trim()} onClick={() => void submit()}>
          Save to Pantry (1 Tap)
        </button>

        <button
          type="button"
          className="text-btn post-scan-more"
          onClick={() =>
            onMoreDetails({
              ...draft,
              category: zone,
              expiryDate: expiry,
            })
          }
        >
          More details (category, threshold, notes…)
        </button>
      </section>
    </div>
  )
}
