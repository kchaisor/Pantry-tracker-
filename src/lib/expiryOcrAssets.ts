const TESS_LANG_PATH = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int'

export type TesseractAssetUrls = {
  workerPath: string
  corePath: string
  langPath: string
}

export type PpOcrAssetUrls = {
  ortWasmMjs: string
  ortWasm: string
  ortWasmLoader: string
  recModel: string
  recKeys: string
}

function normalizeAppBase(appBase: string): string {
  return appBase.endsWith('/') ? appBase : `${appBase}/`
}

export function resolveTesseractBrowserAssetUrls(appBase: string, origin: string): TesseractAssetUrls {
  const normalizedBase = normalizeAppBase(appBase)
  const root = new URL('vendor/tesseract/', `${origin}${normalizedBase}`).href
  const dir = root.replace(/\/$/, '')
  return {
    workerPath: `${dir}/worker.min.js`,
    corePath: dir,
    langPath: TESS_LANG_PATH,
  }
}

export function resolvePpOcrBrowserAssetUrls(appBase: string, origin: string): PpOcrAssetUrls {
  const normalizedBase = normalizeAppBase(appBase)
  const root = new URL('vendor/ppocr/', `${origin}${normalizedBase}`).href
  const dir = root.replace(/\/$/, '')
  return {
    ortWasmMjs: `${dir}/ort.wasm.min.mjs`,
    ortWasm: `${dir}/ort-wasm-simd-threaded.wasm`,
    ortWasmLoader: `${dir}/ort-wasm-simd-threaded.mjs`,
    recModel: `${dir}/ch_PP-OCRv3_rec_infer.onnx`,
    recKeys: `${dir}/rec-keys.json`,
  }
}

export function getTesseractBrowserAssetUrls(): TesseractAssetUrls {
  const appBase = import.meta.env.BASE_URL || '/'
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
  return resolveTesseractBrowserAssetUrls(appBase, origin)
}

export function getPpOcrBrowserAssetUrls(): PpOcrAssetUrls {
  const appBase = import.meta.env.BASE_URL || '/'
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
  return resolvePpOcrBrowserAssetUrls(appBase, origin)
}
