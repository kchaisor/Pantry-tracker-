/**
 * Local OCR check on Kelvin's Pure Valley photo (not committed). Run from repo root:
 *   node scripts/ocr-kelvin-local.mjs /path/to/photo.jpg
 */
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const imagePath =
  process.argv[2] ||
  '/home/ubuntu/.cursor/projects/agent-repos-Pantry-tracker/uploads/pure-valley-best-before_7e8f.jpg'

const dev = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
})

function wait(url, ms = 30_000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        if ((await fetch(url)).ok) return resolve()
      } catch {
        /* retry */
      }
      if (Date.now() - start > ms) reject(new Error(`timeout ${url}`))
      else setTimeout(tick, 250)
    }
    tick()
  })
}

try {
  await wait('http://127.0.0.1:5173/')
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  const buf = readFileSync(imagePath)
  const result = await page.evaluate(async ({ b64, name }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const file = new File([bytes], name, { type: 'image/jpeg' })
    const { runExpiryOcrOnFile } = await import('/src/lib/runExpiryOcr.ts')
    return runExpiryOcrOnFile(file)
  }, { b64: buf.toString('base64'), name: path.basename(imagePath) })

  console.log(JSON.stringify(result, null, 2))
  await browser.close()
} finally {
  dev.kill('SIGTERM')
}
