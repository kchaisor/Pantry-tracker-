import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = '/opt/cursor/artifacts'
const baseUrl = 'http://127.0.0.1:4173/'

function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url)
        if (res.ok) return resolve()
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server not ready: ${url}`))
        return
      }
      setTimeout(tick, 250)
    }
    tick()
  })
}

const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
  cwd: root,
  stdio: 'ignore',
})

try {
  await waitForServer(baseUrl)
  await mkdir(outDir, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })

  await context.addInitScript(() => {
    localStorage.setItem('pantry.welcome.seen', '1')
    localStorage.setItem('pantry.installHint.dismissed', '1')
  })

  const cardsPage = await context.newPage()
  await cardsPage.goto(`${baseUrl}?fixture=live&view=cards`, { waitUntil: 'networkidle' })
  await cardsPage.waitForSelector('.studio-card', { timeout: 15_000 })
  await cardsPage.screenshot({ path: path.join(outDir, 'pantry-direction-a-cards.png'), fullPage: false })

  const listPage = await context.newPage()
  await listPage.goto(`${baseUrl}?fixture=live&view=list`, { waitUntil: 'networkidle' })
  await listPage.waitForSelector('.studio-list-row', { timeout: 15_000 })
  await listPage.screenshot({ path: path.join(outDir, 'pantry-direction-c-list.png'), fullPage: false })

  const scanPage = await context.newPage()
  await scanPage.goto(`${baseUrl}?fixture=live&scanDemo=post-scan-sheet`, { waitUntil: 'networkidle' })
  await scanPage.waitForSelector('.post-scan-sheet', { timeout: 20_000 })
  await scanPage.screenshot({ path: path.join(outDir, 'pantry-post-scan-sheet.png'), fullPage: false })

  await browser.close()
  console.log('Screenshots saved to', outDir)
} finally {
  preview.kill('SIGTERM')
}
