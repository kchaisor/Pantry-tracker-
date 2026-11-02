import { bestExpiryFromText } from './expiryDateParse.ts'

export type ExpiryOcrResult =
  | { status: 'ok'; best: string; alternatives: string[]; rawText: string }
  | { status: 'empty'; rawText: string }
  | { status: 'error'; message: string }

export async function runExpiryOcrOnFile(file: File): Promise<ExpiryOcrResult> {
  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng')
    try {
      const {
        data: { text },
      } = await worker.recognize(file)
      const trimmed = text.trim()
      if (!trimmed) return { status: 'empty', rawText: '' }
      const { best, alternatives } = bestExpiryFromText(trimmed)
      if (!best) return { status: 'empty', rawText: trimmed }
      return { status: 'ok', best, alternatives, rawText: trimmed }
    } finally {
      await worker.terminate()
    }
  } catch {
    return { status: 'error', message: 'Could not read the photo. Try again with better light.' }
  }
}
