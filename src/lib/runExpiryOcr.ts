import { bestExpiryFromText } from './expiryDateParse.ts'
import { getTesseractBrowserAssetUrls } from './expiryOcrAssets.ts'

export type ExpiryOcrResult =
  | { status: 'ok'; best: string; alternatives: string[]; rawText: string }
  | { status: 'empty'; rawText: string }
  | { status: 'error'; message: string }

export { resolveTesseractBrowserAssetUrls, getTesseractBrowserAssetUrls } from './expiryOcrAssets.ts'

const MAX_OCR_SIDE = 1600

let tessWorkerSingleton: import('tesseract.js').Worker | null = null

async function getTesseractWorker(): Promise<import('tesseract.js').Worker> {
  if (tessWorkerSingleton) return tessWorkerSingleton
  const { createWorker, OEM } = await import('tesseract.js')
  const { workerPath, corePath, langPath } = getTesseractBrowserAssetUrls()
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath,
    corePath,
    langPath,
  })
  tessWorkerSingleton = worker
  return worker
}

export async function runTesseractRawLineOnCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const { PSM } = await import('tesseract.js')
  const worker = await getTesseractWorker()
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.RAW_LINE,
    tessedit_char_whitelist:
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/.:\\- ',
  })
  const {
    data: { text },
  } = await worker.recognize(canvas)
  return text.trim()
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

/** @deprecated Full-frame path; prefer crop flow via runExpiryPhotoReadOnCrop. */
export async function runExpiryOcrOnFile(file: File): Promise<ExpiryOcrResult> {
  try {
    const canvas = await prepareImageForExpiryOcr(file)
    const trimmed = await runTesseractRawLineOnCanvas(canvas)
    if (!trimmed) return { status: 'empty', rawText: '' }
    const { best, alternatives } = bestExpiryFromText(trimmed)
    if (!best) return { status: 'empty', rawText: trimmed }
    return { status: 'ok', best, alternatives, rawText: trimmed }
  } catch (err) {
    console.error('[expiry OCR]', err)
    return {
      status: 'error',
      message: 'Could not read the photo. Try again, or enter the date manually.',
    }
  }
}
