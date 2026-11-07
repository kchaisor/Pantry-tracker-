import { bestExpiryFromText } from './expiryDateParse.ts'

export type ExpiryOcrResult =
  | { status: 'ok'; best: string; alternatives: string[]; rawText: string }
  | { status: 'empty'; rawText: string }
  | { status: 'error'; message: string }

const TESS_LANG_PATH = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int'

/** Builds same-origin URLs so Tesseract loads under Vite `base` (e.g. `/Pantry-tracker-/`). */
export function resolveTesseractBrowserAssetUrls(appBase: string, origin: string): {
  workerPath: string
  corePath: string
  langPath: string
} {
  const normalizedBase = appBase.endsWith('/') ? appBase : `${appBase}/`
  const root = new URL('vendor/tesseract/', `${origin}${normalizedBase}`).href
  const dir = root.replace(/\/$/, '')
  return {
    workerPath: `${dir}/worker.min.js`,
    corePath: dir,
    langPath: TESS_LANG_PATH,
  }
}

export function getTesseractBrowserAssetUrls(): {
  workerPath: string
  corePath: string
  langPath: string
} {
  const appBase = import.meta.env.BASE_URL || '/'
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
  return resolveTesseractBrowserAssetUrls(appBase, origin)
}

const MAX_OCR_SIDE = 1600

/** Returns a canvas: tesseract.js does not accept ImageBitmap as recognize() input in the browser. */
export async function prepareImageForExpiryOcr(file: File): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    try {
      bitmap = await createImageBitmap(file)
    } catch {
      throw new Error('Could not open this image format.')
    }
  }

  try {
    const w = bitmap.width
    const h = bitmap.height
    if (!w || !h) throw new Error('Invalid image dimensions.')

    const scale = Math.min(1, MAX_OCR_SIDE / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available.')

    ctx.filter = 'contrast(1.2) brightness(1.05)'
    ctx.drawImage(bitmap, 0, 0, tw, th)

    return canvas
  } finally {
    bitmap.close()
  }
}

export async function runExpiryOcrOnFile(file: File): Promise<ExpiryOcrResult> {
  try {
    const { createWorker, OEM, PSM } = await import('tesseract.js')
    const { workerPath, corePath, langPath } = getTesseractBrowserAssetUrls()

    const worker = await createWorker('eng', OEM.LSTM_ONLY, {
      workerPath,
      corePath,
      langPath,
    })

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/.:\\- ',
      })

      const canvas = await prepareImageForExpiryOcr(file)
      const {
        data: { text },
      } = await worker.recognize(canvas)
      const trimmed = text.trim()
      if (!trimmed) return { status: 'empty', rawText: '' }
      const { best, alternatives } = bestExpiryFromText(trimmed)
      if (!best) return { status: 'empty', rawText: trimmed }
      return { status: 'ok', best, alternatives, rawText: trimmed }
    } finally {
      await worker.terminate()
    }
  } catch (err) {
    console.error('[expiry OCR]', err)
    return {
      status: 'error',
      message: 'Could not read the photo. Try again, or enter the date manually.',
    }
  }
}
