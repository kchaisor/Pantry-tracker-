import { bestExpiryFromText } from './expiryDateParse.ts'
import { canvasPreviewUrl } from './expiryCropCanvas.ts'
import { expiryConfirmChipsFromReads } from './expiryReadChips.ts'
import type { ExpiryPhotoReadResult, ExpiryReadLine } from './expiryPhotoReadTypes.ts'
import { ppOcrTensorFromColorCanvas, thresholdDilateCanvas } from './ppOcrPreprocess.ts'
import { recognizeWithPpOcr } from './ppOcrClient.ts'
import { runTesseractRawLineOnCanvas } from './runExpiryOcr.ts'

export async function runExpiryPhotoReadOnCrop(canvas: HTMLCanvasElement): Promise<ExpiryPhotoReadResult> {
  try {
    const cropPreviewUrl = canvasPreviewUrl(canvas)
    const colorPack = ppOcrTensorFromColorCanvas(canvas)
    const altCanvas = thresholdDilateCanvas(canvas, 130, 3)

  const [ppText, tessText] = await Promise.all([
      recognizeWithPpOcr(colorPack),
      runTesseractRawLineOnCanvas(altCanvas),
    ])

    const reads: ExpiryReadLine[] = [
      { engine: 'ppocr', rawText: ppText, iso: bestExpiryFromText(ppText).best },
      { engine: 'tesseract', rawText: tessText, iso: bestExpiryFromText(tessText).best },
    ]

    const chips = expiryConfirmChipsFromReads(reads)
    if (chips.length === 0) {
      return { status: 'empty', cropPreviewUrl, reads }
    }
    return { status: 'ok', cropPreviewUrl, reads, chips }
  } catch (err) {
    console.error('[expiry photo read]', err)
    return {
      status: 'error',
      message: 'Could not read this crop. Try again, or enter the date manually.',
    }
  }
}
