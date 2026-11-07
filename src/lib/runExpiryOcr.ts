import { bestExpiryFromText, parseExpiryDatesFromText } from './expiryDateParse.ts'
import { buildExpiryOcrCanvases, maxOcrLongEdge, prepareDotMatrixInkCanvas } from './expiryOcrFrames.ts'

export type ExpiryOcrResult =
  | { status: 'ok'; best: string; alternatives: string[]; rawText: string }
  | { status: 'empty'; rawText: string }
  | { status: 'error'; message: string }

const TESS_LANG_PATH = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int'

const CONFIDENT_PARSE_SCORE = 18

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

    const maxSide = maxOcrLongEdge()
    const scale = Math.min(1, maxSide / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available.')

    ctx.filter = 'contrast(1.15) brightness(1.03)'
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
        tessedit_pageseg_mode: PSM.AUTO,
        user_defined_dpi: '300',
      })

      const prepared = await prepareImageForExpiryOcr(file)
      const frames = buildExpiryOcrCanvases(prepared)
      const parts: string[] = []

      const tryCombined = (): ExpiryOcrResult | null => {
        const combined = parts.join('\n').trim()
        if (!combined) return null
        const { best, alternatives } = bestExpiryFromText(combined)
        if (!best) return null
        return { status: 'ok', best, alternatives, rawText: combined }
      }

      const ingest = (text: string): ExpiryOcrResult | null => {
        const chunk = text.trim()
        if (!chunk) return null
        parts.push(chunk)
        const ranked = parseExpiryDatesFromText(parts.join('\n'))
        if (ranked[0] && ranked[0].score >= CONFIDENT_PARSE_SCORE) {
          return tryCombined()
        }
        return null
      }

      for (const frame of frames) {
        const lineish = frame.width > frame.height * 1.3
        await worker.setParameters({
          tessedit_pageseg_mode: lineish ? PSM.SINGLE_LINE : PSM.AUTO,
          tessedit_char_whitelist: '',
        })
        const {
          data: { text },
        } = await worker.recognize(frame)
        const hit = ingest(text)
        if (hit) return hit
      }

      const ink = prepareDotMatrixInkCanvas(prepared)
      for (const psm of [PSM.SINGLE_LINE, PSM.SINGLE_BLOCK]) {
        await worker.setParameters({
          tessedit_pageseg_mode: psm,
          tessedit_char_whitelist: '0123456789/:.',
        })
        const {
          data: { text },
        } = await worker.recognize(ink)
        const hit = ingest(text)
        if (hit) return hit
      }

      await worker.setParameters({ tessedit_char_whitelist: '' })

      const combined = parts.join('\n').trim()
      if (!combined) return { status: 'empty', rawText: '' }
      const { best, alternatives } = bestExpiryFromText(combined)
      if (!best) return { status: 'empty', rawText: combined }
      return { status: 'ok', best, alternatives, rawText: combined }
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
