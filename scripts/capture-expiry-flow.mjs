import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
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

  const labelPath = path.join(outDir, 'expiry-label-sample.png')
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
    localStorage.setItem('pantry.lastAdd', JSON.stringify({ unit: 'pcs', category: 'Dairy' }))
  })

  const page = await context.newPage()
  await page.goto(`${baseUrl}?fixture=live`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '+ Add' }).click()
  await page.waitForSelector('.editor-sheet', { timeout: 15_000 })
  const editor = page.locator('.editor-sheet')
  await editor.getByRole('button', { name: 'Dairy', exact: true }).click()
  await editor.locator('.expiry-block--suggested').waitFor({ timeout: 10_000 })
  await page.screenshot({ path: path.join(outDir, 'pantry-expiry-suggested.png'), fullPage: false })

  await editor.getByLabel('Expiry shortcuts').getByRole('button', { name: '+1w' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(outDir, 'pantry-expiry-chip.png'), fullPage: false })

  const pngBase64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 140
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#111111'
    ctx.font = 'bold 32px Arial'
    ctx.fillText('BEST BEFORE 15/03/2027', 24, 82)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await writeFile(labelPath, Buffer.from(pngBase64, 'base64'))

  await editor.locator('input[type="file"][accept="image/*"]').setInputFiles(labelPath)
  await editor.locator('.expiry-ocr-confirm').waitFor({ timeout: 120_000 })
  await page.screenshot({ path: path.join(outDir, 'pantry-expiry-ocr-confirm.png'), fullPage: false })

  await browser.close()
  console.log('Expiry flow screenshots saved to', outDir)
} finally {
  preview.kill('SIGTERM')
}
