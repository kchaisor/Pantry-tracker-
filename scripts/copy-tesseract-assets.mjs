import { cp, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const destDir = path.join(root, 'public', 'vendor', 'tesseract')

await mkdir(destDir, { recursive: true })

await cp(
  path.join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
  path.join(destDir, 'worker.min.js'),
)
await cp(path.join(root, 'node_modules', 'tesseract.js-core'), destDir, { recursive: true })
