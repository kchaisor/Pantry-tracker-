import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveTesseractBrowserAssetUrls } from './runExpiryOcr.ts'

const runExpiryOcrSource = readFileSync(fileURLToPath(new URL('./runExpiryOcr.ts', import.meta.url)), 'utf8')

describe('resolveTesseractBrowserAssetUrls', () => {
  it('prefixes worker and core with GitHub Pages base path', () => {
    const { workerPath, corePath, langPath } = resolveTesseractBrowserAssetUrls(
      '/Pantry-tracker-/',
      'https://kchaisor.github.io',
    )
    expect(workerPath).toBe('https://kchaisor.github.io/Pantry-tracker-/vendor/tesseract/worker.min.js')
    expect(corePath).toBe('https://kchaisor.github.io/Pantry-tracker-/vendor/tesseract')
    expect(langPath).toMatch(/^https:\/\//)
  })

  it('handles base without trailing slash', () => {
    const { workerPath } = resolveTesseractBrowserAssetUrls('/Pantry-tracker-', 'https://example.com')
    expect(workerPath).toBe('https://example.com/Pantry-tracker-/vendor/tesseract/worker.min.js')
  })
})

describe('runExpiryOcr implementation invariants', () => {
  it('passes a canvas to worker.recognize (ImageBitmap breaks tesseract.js loadImage in browsers)', () => {
    expect(runExpiryOcrSource).toContain('await worker.recognize(canvas)')
    expect(runExpiryOcrSource).toContain('HTMLCanvasElement')
  })
})
