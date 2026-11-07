import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { suggestedExpiryForCategory } from '../lib/categoryShelfLife.ts'
import { EXPIRY_QUICK_CHIPS, expiryFromQuickChip } from '../lib/expiryQuickChips.ts'
import { runExpiryOcrOnFile } from '../lib/runExpiryOcr.ts'

interface ExpiryFieldProps {
  value: string
  category: string
  allowSuggestion?: boolean
  gs1Applied?: boolean
  highlightScan?: boolean
  onChange: (iso: string) => void
  onDismissScanHints?: () => void
  inputRef?: RefObject<HTMLInputElement | null>
}

export function ExpiryField({
  value,
  category,
  allowSuggestion = true,
  gs1Applied = false,
  highlightScan = false,
  onChange,
  onDismissScanHints,
  inputRef,
}: ExpiryFieldProps) {
  const localRef = useRef<HTMLInputElement>(null)
  const expiryRef = inputRef ?? localRef
  const fileRef = useRef<HTMLInputElement>(null)
  const expiryInputId = useId()
  const ocrHintId = useId()
  const [suggested, setSuggested] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrPick, setOcrPick] = useState<{ best: string; alternatives: string[] } | null>(null)
  const [ocrNotice, setOcrNotice] = useState<string | null>(null)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const lastCategoryRef = useRef(category)

  useEffect(() => {
    if (!allowSuggestion || gs1Applied) {
      setSuggested(false)
      return
    }
    const cat = category.trim()
    if (!cat) return
    const categoryChanged = lastCategoryRef.current !== category
    lastCategoryRef.current = category
    if (value && !suggested && !categoryChanged) return
    const next = suggestedExpiryForCategory(cat)
    if (next && next !== value) {
      onChangeRef.current(next)
      setSuggested(true)
    } else if (!next && (suggested || !value)) {
      if (value) onChangeRef.current('')
      setSuggested(false)
    }
  }, [allowSuggestion, category, gs1Applied, suggested, value])

  const setDate = (iso: string, fromSuggestion = false) => {
    onChange(iso)
    setSuggested(fromSuggestion)
    setOcrPick(null)
    setOcrNotice(null)
    onDismissScanHints?.()
  }

  const onManualChange = (iso: string) => {
    setSuggested(false)
    setOcrPick(null)
    setOcrNotice(null)
    onChange(iso)
    onDismissScanHints?.()
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
        setOcrNotice(
          'No date found on the photo — try a closer shot of the expiry line, or set the date below.',
        )
        return
      }
      setOcrPick({ best: result.best, alternatives: result.alternatives })
    } finally {
      setOcrBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const showSuggested = suggested && value && !gs1Applied

  return (
    <div
      className={`expiry-block ${highlightScan ? 'expiry-block--scan' : ''} ${showSuggested ? 'expiry-block--suggested' : ''}`}
      data-scan-expiry={highlightScan ? 'true' : undefined}
    >
      <div className="expiry-label-row">
        <span className="expiry-field-label" id={expiryInputId}>
          Expiry / best before
        </span>
        <div className="expiry-row">
          <input
            ref={expiryRef}
            id={`${expiryInputId}-input`}
            type="date"
            value={value}
            className={`expiry-date-input${showSuggested ? ' expiry-input-suggested' : ''}`}
            aria-labelledby={expiryInputId}
            aria-describedby={ocrPick || ocrNotice ? ocrHintId : undefined}
            onChange={(event) => onManualChange(event.target.value)}
          />
          <button
            type="button"
            className="ghost-btn expiry-photo-btn"
            disabled={ocrBusy}
            aria-label="Scan expiry date from photo"
            onClick={() => fileRef.current?.click()}
          >
            {ocrBusy ? '…' : 'Photo'}
          </button>
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
        </div>
      </div>

      {gs1Applied && value ? (
        <p className="form-hint">Expiry from GS1 barcode (AI 17).</p>
      ) : showSuggested ? (
        <p className="form-hint expiry-suggest-hint">
          Suggested from category — change, use a chip, or clear.
        </p>
      ) : highlightScan ? (
        <p className="form-hint">Plain barcodes do not include expiry — pick a date or scan the pack.</p>
      ) : null}

      {ocrNotice ? (
        <p className="form-hint" id={ocrHintId}>
          {ocrNotice}
        </p>
      ) : null}

      {ocrPick ? (
        <div className="expiry-ocr-confirm" id={ocrHintId} role="group" aria-label="Confirm scanned expiry">
          <p className="form-hint">Found on pack — confirm before saving:</p>
          <div className="chips wrap">
            <button type="button" className="chip is-on" onClick={() => setDate(ocrPick.best, false)}>
              {ocrPick.best}
            </button>
            {ocrPick.alternatives.map((alt) => (
              <button key={alt} type="button" className="chip" onClick={() => setDate(alt, false)}>
                {alt}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => setOcrPick(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="chips wrap expiry-quick-chips" aria-label="Expiry shortcuts">
        {EXPIRY_QUICK_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="chip expiry-chip"
            onClick={() => {
              setDate(expiryFromQuickChip(chip.days), false)
              expiryRef.current?.focus()
            }}
          >
            {chip.label}
          </button>
        ))}
        <button
          type="button"
          className="chip expiry-chip"
          onClick={() => {
            setDate('', false)
            expiryRef.current?.focus()
          }}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
