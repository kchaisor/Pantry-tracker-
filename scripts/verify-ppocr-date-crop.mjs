import { createRequire } from 'node:module'
import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ort = require('onnxruntime-node')
const sharp = require('sharp')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const vendor = path.join(root, 'public', 'vendor', 'ppocr')

const cropPath =
  process.env.EXPIRY_TEST_CROP ??
  '/home/ubuntu/.cursor/projects/agent-repos-Pantry-tracker/assets/date-color.png'

const PP_OCR_REC_HEIGHT = 48

function decodeRec(output, chars) {
  const steps = output.dims[1]
  const n = output.dims[2]
  const data = output.data
  let text = ''
  let prev = -1
  for (let t = 0; t < steps; t++) {
    let best = 0
    for (let j = 1; j < n; j++) {
      if (data[t * n + j] > data[t * n + best]) best = j
    }
    if (best && best !== prev) text += chars[best] ?? ''
    prev = best
  }
  return text.trim()
}

function assetBytes(p) {
  return statSync(p).size
}

function gzSize(buf) {
  return gzipSync(buf).length
}

const modelPath = path.join(vendor, 'ch_PP-OCRv3_rec_infer.onnx')
const keys = JSON.parse(readFileSync(path.join(vendor, 'rec-keys.json'), 'utf8'))
const chars = ['', ...keys.character.split('\n'), ' ']

const shipped = [
  'ch_PP-OCRv3_rec_infer.onnx',
  'ort.wasm.min.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'rec-keys.json',
].map((name) => {
  const p = path.join(vendor, name)
  const raw = readFileSync(p)
  return { name, rawBytes: raw.length, gzipBytes: gzSize(raw) }
})

const totalGzip = shipped.reduce((a, f) => a + f.gzipBytes, 0)

const session = await ort.InferenceSession.create(modelPath)
const meta = await sharp(cropPath).metadata()
const h = PP_OCR_REC_HEIGHT
const w = Math.floor((h * meta.width) / meta.height)
const { data } = await sharp(cropPath)
  .resize(w, h, { fit: 'fill', kernel: 'linear' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const tensor = new Float32Array(3 * w * h)
for (let c = 0; c < 3; c++) {
  for (let i = 0; i < w * h; i++) {
    tensor[c * w * h + i] = data[3 * i + (2 - c)] / 127.5 - 1
  }
}

const out = Object.values(await session.run({ x: new ort.Tensor('float32', tensor, [1, 3, h, w]) }))[0]
const text = decodeRec(out, chars)

console.log(
  JSON.stringify(
    {
      crop: cropPath,
      recognizedText: text,
      expectedIso: text.includes('27/01/2027') ? '2027-01-27' : null,
      shippedAssets: shipped,
      totalShippedGzipBytes: totalGzip,
    },
    null,
    2,
  ),
)

if (!text.includes('27/01/2027')) {
  process.exitCode = 1
}
