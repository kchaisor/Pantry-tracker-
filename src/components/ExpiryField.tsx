import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { suggestedExpiryForCategory } from '../lib/categoryShelfLife.ts'
import { EXPIRY_QUICK_CHIPS, expiryFromQuickChip } from '../lib/expiryQuickChips.ts'
import { formatExpiryAu } from '../lib/expiryDateDisplay.ts'
import { bestExpiryFromText } from '../lib/expiryDateParse.ts'
import { ExpiryPhotoSheet } from './ExpiryPhotoSheet.tsx'

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
  const ocrHintId = useId()
  const typedId = useId()
  const [suggested, setSuggested] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [typedExpiry, setTypedExpiry] = useState('')
  const [typedNotice, setTypedNotice] = useState<string | null>(null)

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
    setTypedNotice(null)
    onDismissScanHints?.()
  }

  const onManualChange = (iso: string) => {
    setSuggested(false)
    setTypedNotice(null)
    onChange(iso)
    onDismissScanHints?.()
  }

  const onPhotoFile = (file: File | undefined) => {
    if (!file) return
    setPhotoFile(file)
    setPhotoOpen(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  const applyTyped = () => {
    const iso = bestExpiryFromText(typedExpiry).best
    if (!iso) {
      setTypedNotice('No valid date — try DD/MM/YYYY or 27 January 2027.')
      return
    }
    setDate(iso, false)
    setTypedExpiry('')
    setTypedNotice(null)
  }

  const showSuggested = suggested && value && !gs1Applied

  return (
    <div
      className={`expiry-block ${highlightScan ? 'expiry-block--scan' : ''} ${showSuggested ? 'expiry-block--suggested' : ''}`}
      data-scan-expiry={highlightScan ? 'true' : undefined}
    >
      <div className="expiry-field-label">Expiry / best before</div>
      <div className="expiry-row">
        <input
          ref={expiryRef}
          type="date"
          value={value}
          className={showSuggested ? 'expiry-input-suggested' : undefined}
          aria-describedby={typedNotice ? ocrHintId : undefined}
          onChange={(event) => onManualChange(event.target.value)}
        />
        <button
          type="button"
          className="ghost-btn expiry-photo-btn"
          aria-label="Scan expiry date from photo"
          onClick={() => setPhotoOpen(true)}
        >
          Photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => onPhotoFile(event.target.files?.[0])}
        />
      </div>

      <label className="expiry-type-label" htmlFor={typedId}>
        Type or dictate (mic on keyboard)
      </label>
      <div className="expiry-type-row">
        <input
          id={typedId}
          type="text"
          inputMode="text"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="27/01/2027"
          value={typedExpiry}
          onChange={(e) => {
            setTypedExpiry(e.target.value)
            setTypedNotice(null)
          }}
        />
        <button type="button" className="chip" onClick={applyTyped}>
          Parse
        </button>
      </div>

      {gs1Applied && value ? (
        <p className="form-hint">Expiry from GS1 barcode (AI 17).</p>
      ) : showSuggested ? (
        <p className="form-hint expiry-suggest-hint">
          Suggested {formatExpiryAu(value)} from category — change, use a chip, or clear.
        </p>
      ) : highlightScan ? (
        <p className="form-hint">Plain barcodes do not include expiry — pick a date or scan the pack.</p>
      ) : null}

      {typedNotice ? (
        <p className="form-hint" id={ocrHintId}>
          {typedNotice}
        </p>
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

      <ExpiryPhotoSheet
        open={photoOpen}
        file={photoFile}
        onClose={() => {
          setPhotoOpen(false)
          setPhotoFile(null)
        }}
        onConfirm={(iso) => setDate(iso, false)}
        onRequestPhoto={() => fileRef.current?.click()}
      />
    </div>
  )
}
