import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveTesseractBrowserAssetUrls } from './expiryOcrAssets.ts'

const runExpiryOcrSource = readFileSync(fileURLToPath(new URL('./runExpiryOcr.ts', import.meta.url)), 'utf8')

describe('resolveTesseractBrowserAssetUrls', () => {
  it('uses same-origin vendor paths under repo base', () => {
    const urls = resolveTesseractBrowserAssetUrls('/Pantry-tracker-/', 'https://example.github.io')
    expect(urls.workerPath).toContain('/Pantry-tracker-/vendor/tesseract/worker.min.js')
    expect(urls.corePath).toContain('/Pantry-tracker-/vendor/tesseract')
  })
})

describe('runExpiryOcr implementation invariants', () => {
  it('recognizes via canvas and uses RAW_LINE for crop tess path', () => {
    expect(runExpiryOcrSource).toContain('runTesseractRawLineOnCanvas')
    expect(runExpiryOcrSource).toContain('PSM.RAW_LINE')
    expect(runExpiryOcrSource).toContain('HTMLCanvasElement')
  })
})
