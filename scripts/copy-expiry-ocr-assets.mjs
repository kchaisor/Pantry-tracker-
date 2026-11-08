import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const tessDest = path.join(root, 'public', 'vendor', 'tesseract')
await mkdir(tessDest, { recursive: true })
await cp(
  path.join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
  path.join(tessDest, 'worker.min.js'),
)
await cp(path.join(root, 'node_modules', 'tesseract.js-core'), tessDest, { recursive: true })

const ppDest = path.join(root, 'public', 'vendor', 'ppocr')
await mkdir(ppDest, { recursive: true })

const onnxDist = path.join(root, 'node_modules', 'onnxruntime-web', 'dist')
await cp(path.join(onnxDist, 'ort.wasm.min.mjs'), path.join(ppDest, 'ort.wasm.min.mjs'))
await cp(path.join(onnxDist, 'ort-wasm-simd-threaded.wasm'), path.join(ppDest, 'ort-wasm-simd-threaded.wasm'))
await cp(path.join(onnxDist, 'ort-wasm-simd-threaded.mjs'), path.join(ppDest, 'ort-wasm-simd-threaded.mjs'))

const modelPath = path.join(ppDest, 'ch_PP-OCRv3_rec_infer.onnx')
const keysPath = path.join(ppDest, 'rec-keys.json')

const PP_OCR_MODEL_URL =
  'https://github.com/Kazuhito00/PaddleOCR-ONNX-Sample/raw/507132aeab35c62336bf0153c21c40c6e9e4c68e/ppocr_onnx/model/rec_model/ch_PP-OCRv3_rec_infer.onnx'
const PPOCR_KEYS_URL =
  'https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/release/2.7/ppocr/utils/ppocr_keys_v1.txt'

async function ensureFile(dest, url) {
  try {
    await readFile(dest)
    return
  } catch {
    /* download */
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(dest, buf)
}

await ensureFile(modelPath, PP_OCR_MODEL_URL)

try {
  await readFile(keysPath)
} catch {
  const res = await fetch(PPOCR_KEYS_URL)
  if (!res.ok) throw new Error(`Download failed ${PPOCR_KEYS_URL}: ${res.status}`)
  const text = await res.text()
  await writeFile(keysPath, JSON.stringify({ character: text.replace(/\r\n/g, '\n').trimEnd() }))
}
