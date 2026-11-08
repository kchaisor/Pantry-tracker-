import { describe, expect, it } from 'vitest'
import { resolvePpOcrBrowserAssetUrls, resolveTesseractBrowserAssetUrls } from './expiryOcrAssets.ts'

describe('expiry OCR asset URLs', () => {
  it('resolves Tesseract vendor paths under GitHub Pages base', () => {
    const urls = resolveTesseractBrowserAssetUrls('/Pantry-tracker-/', 'https://kchaisor.github.io')
    expect(urls.workerPath).toBe('https://kchaisor.github.io/Pantry-tracker-/vendor/tesseract/worker.min.js')
    expect(urls.corePath).toBe('https://kchaisor.github.io/Pantry-tracker-/vendor/tesseract')
  })

  it('resolves PP-OCR vendor paths under GitHub Pages base', () => {
    const urls = resolvePpOcrBrowserAssetUrls('/Pantry-tracker-/', 'https://kchaisor.github.io')
    expect(urls.recModel).toBe(
      'https://kchaisor.github.io/Pantry-tracker-/vendor/ppocr/ch_PP-OCRv3_rec_infer.onnx',
    )
    expect(urls.ortWasm).toBe(
      'https://kchaisor.github.io/Pantry-tracker-/vendor/ppocr/ort-wasm-simd-threaded.wasm',
    )
    expect(urls.recKeys).toBe('https://kchaisor.github.io/Pantry-tracker-/vendor/ppocr/rec-keys.json')
  })
})
