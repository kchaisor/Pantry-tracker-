import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatExpiryAu } from '../lib/expiryDateDisplay.ts'
import { bestExpiryFromText } from '../lib/expiryDateParse.ts'
import {
  loadOrientedImageBitmap,
  renderCropToCanvas,
  type CropTransform,
} from '../lib/expiryCropCanvas.ts'
import type { ExpiryPhotoReadResult } from '../lib/expiryPhotoReadTypes.ts'
import { runExpiryPhotoReadOnCrop } from '../lib/runExpiryPhotoRead.ts'

type Step = 'guide' | 'crop' | 'read' | 'result'

interface ExpiryPhotoSheetProps {
  open: boolean
  onClose: () => void
  onConfirm: (iso: string) => void
  file?: File | null
  onRequestPhoto: () => void
}

const DEFAULT_CROP = { x: 0.05, y: 0.38, w: 0.9, h: 0.22 }

export function ExpiryPhotoSheet({ open, onClose, onConfirm, file, onRequestPhoto }: ExpiryPhotoSheetProps) {
  const titleId = useId()
  const [step, setStep] = useState<Step>('guide')
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [rotation, setRotation] = useState(0)
  const [crop, setCrop] = useState(DEFAULT_CROP)
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')
  const [typedNotice, setTypedNotice] = useState<string | null>(null)
  const [read, setRead] = useState<ExpiryPhotoReadResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (!file) {
      setStep('guide')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }
        const url = URL.createObjectURL(file)
        objectUrlRef.current = url
        setPreviewUrl(url)
        const bmp = await loadOrientedImageBitmap(file)
        if (cancelled) {
          bmp.close()
          return
        }
        setBitmap((prev) => {
          prev?.close()
          return bmp
        })
        setRotation(0)
        setCrop(DEFAULT_CROP)
        setRead(null)
        setStep('crop')
      } catch {
        setTypedNotice('Could not open that photo.')
        setStep('guide')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file, open])

  useEffect(() => {
    if (!open) {
      setBitmap((prev) => {
        prev?.close()
        return null
      })
      setRead(null)
      setTyped('')
      setTypedNotice(null)
      setStep('guide')
      setPreviewUrl(null)
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [open])

  const previewStyle = useMemo(() => {
    if (!previewUrl) return undefined
    return {
      backgroundImage: `url(${previewUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    } as const
  }, [previewUrl])

  const runRead = async () => {
    if (!bitmap) return
    setBusy(true)
    setStep('read')
    setRead(null)
    try {
      const transform: CropTransform = { rotationQuarter: rotation, cropNorm: crop }
      const canvas = renderCropToCanvas(bitmap, transform)
      const result = await runExpiryPhotoReadOnCrop(canvas)
      setRead(result)
      setStep('result')
    } finally {
      setBusy(false)
    }
  }

  const applyTyped = () => {
    const iso = bestExpiryFromText(typed).best
    if (!iso) {
      setTypedNotice('No valid date in that text — try DD/MM/YYYY or 27 January 2027.')
      return
    }
    setTypedNotice(null)
    onConfirm(iso)
    onClose()
  }

  if (!open) return null

  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <section className="sheet expiry-photo-sheet">
        <header className="post-scan-head">
          <button type="button" className="text-btn" onClick={onClose}>
            Cancel
          </button>
          <h2 id={titleId}>Expiry photo</h2>
          <span className="post-scan-spacer" />
        </header>

        {step === 'guide' ? (
          <div className="expiry-photo-guide">
            <p className="form-hint">
              Fill the box with the printed date line — not the whole pack. Nothing is uploaded.
            </p>
            <div className="expiry-photo-guide-frame" aria-hidden="true">
              <div className="expiry-photo-guide-box" />
            </div>
            <button type="button" className="primary-btn" onClick={onRequestPhoto}>
              Take or choose photo
            </button>
          </div>
        ) : null}

        {step === 'crop' && bitmap ? (
          <div className="expiry-photo-crop">
            <p className="form-hint">Drag sliders so the whole date and separators stay inside the box.</p>
            <div className="expiry-photo-crop-stage">
              <div className="expiry-photo-crop-image" style={previewStyle} />
              <div
                className="expiry-photo-crop-box"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
              />
            </div>
            <label className="expiry-photo-slider">
              Vertical position
              <input
                type="range"
                min={0}
                max={78}
                value={Math.round(crop.y * 100)}
                onChange={(e) => setCrop((c) => ({ ...c, y: Number(e.target.value) / 100 }))}
              />
            </label>
            <label className="expiry-photo-slider">
              Crop height
              <input
                type="range"
                min={12}
                max={45}
                value={Math.round(crop.h * 100)}
                onChange={(e) => setCrop((c) => ({ ...c, h: Number(e.target.value) / 100 }))}
              />
            </label>
            <div className="chips wrap">
              <button
                type="button"
                className="chip"
                onClick={() => setRotation((r) => (r + 3) % 4)}
              >
                Rotate left
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => setRotation((r) => (r + 1) % 4)}
              >
                Rotate right
              </button>
            </div>
            <button type="button" className="primary-btn" disabled={busy} onClick={() => void runRead()}>
              Read crop
            </button>
          </div>
        ) : null}

        {step === 'read' ? (
          <p className="form-hint" role="status">
            Reading on this device… first use downloads the on-device reader (~13&nbsp;MB).
          </p>
        ) : null}

        {step === 'result' && read ? (
          <div className="expiry-photo-result">
            {read.status === 'error' ? (
              <p className="form-hint">{read.message}</p>
            ) : read.status === 'empty' ? (
              <>
                {read.cropPreviewUrl ? (
                  <img
                    className="expiry-photo-crop-preview"
                    src={read.cropPreviewUrl}
                    alt="Cropped expiry line used for reading"
                  />
                ) : null}
                <div className="expiry-photo-raw-reads">
                  {read.reads.map((row) => (
                    <p key={row.engine} className="form-hint">
                      <strong>{row.engine === 'ppocr' ? 'Reader A' : 'Reader B'}:</strong>{' '}
                      {row.rawText || '(empty)'}
                    </p>
                  ))}
                </div>
                <p className="form-hint">No date parsed — adjust the crop or type the date below.</p>
              </>
            ) : (
              <>
                {read.cropPreviewUrl ? (
                  <img
                    className="expiry-photo-crop-preview"
                    src={read.cropPreviewUrl}
                    alt="Cropped expiry line used for reading"
                  />
                ) : null}
                <div className="expiry-photo-raw-reads">
                  {read.reads.map((row) => (
                    <p key={row.engine} className="form-hint">
                      <strong>{row.engine === 'ppocr' ? 'Reader A' : 'Reader B'}:</strong>{' '}
                      {row.rawText || '(empty)'}
                      {row.iso ? ` → ${formatExpiryAu(row.iso)}` : ''}
                    </p>
                  ))}
                </div>
                <div className="expiry-ocr-confirm" role="group" aria-label="Confirm scanned expiry">
                  <p className="form-hint">Confirm before applying:</p>
                  <div className="chips wrap">
                    {read.chips.map((chip) => (
                      <button
                        key={chip.iso}
                        type="button"
                        className={`chip ${chip.engines.length > 1 ? 'is-on' : ''}`}
                        onClick={() => {
                          onConfirm(chip.iso)
                          onClose()
                        }}
                      >
                        {chip.label}
                        {chip.engines.length > 1 ? ' ✓' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className="expiry-photo-typed">
          <label className="expiry-field-label" htmlFor={`${titleId}-typed`}>
            Or type / dictate date
          </label>
          <input
            id={`${titleId}-typed`}
            type="text"
            inputMode="text"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="27/01/2027 or 27 January 2027"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value)
              setTypedNotice(null)
            }}
          />
          {typedNotice ? <p className="form-hint">{typedNotice}</p> : null}
          <button type="button" className="ghost-btn" onClick={applyTyped}>
            Parse typed date
          </button>
        </div>
      </section>
    </div>
  )
}
