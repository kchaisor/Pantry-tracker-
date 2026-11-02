import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { verifyDistinctExpiryScreenshots } from './expiryScreenshotVerify.mjs'

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

/** Scroll expiry into view and screenshot that section only. */
async function screenshotExpiryBlock(page, editor, outPath) {
  const expiry = editor.locator('.expiry-block').first()
  await expiry.waitFor({ state: 'visible', timeout: 15_000 })
  await expiry.scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  await expiry.screenshot({ path: outPath })
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
    localStorage.setItem('pantry.lastAdd', JSON.stringify({ unit: 'pcs', category: '' }))
  })

  const page = await context.newPage()
  await page.goto(`${baseUrl}?fixture=live`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '+ Add' }).click()
  await page.waitForSelector('.editor-sheet', { timeout: 15_000 })

  const editor = page.locator('.editor-sheet')
  const dateInput = editor.locator('input[type="date"]')

  await editor.getByRole('button', { name: 'Produce', exact: true }).click()
  await editor.locator('.expiry-block--suggested').waitFor({ timeout: 10_000 })
  await editor.getByLabel('Expiry shortcuts').getByRole('button', { name: '+3d' }).waitFor()

  const suggestedPath = path.join(outDir, 'pantry-expiry-suggested.png')
  await screenshotExpiryBlock(page, editor, suggestedPath)

  const beforeChip = await dateInput.inputValue()
  await editor.getByLabel('Expiry shortcuts').getByRole('button', { name: '+1w' }).click()
  await page.waitForFunction(
    (prev) => {
      const input = document.querySelector('.editor-sheet input[type="date"]')
      return input instanceof HTMLInputElement && input.value && input.value !== prev
    },
    beforeChip,
    { timeout: 5000 },
  )
  await editor.locator('.expiry-block--suggested').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {
    /* suggestion styling may already be off */
  })

  const chipPath = path.join(outDir, 'pantry-expiry-chip.png')
  await screenshotExpiryBlock(page, editor, chipPath)

  const pngBase64 = await page.evaluate(() => {
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

  const ocrPath = path.join(outDir, 'pantry-expiry-ocr-confirm.png')
  await screenshotExpiryBlock(page, editor, ocrPath)

  await browser.close()

  const verified = await verifyDistinctExpiryScreenshots(outDir)
  console.log('Expiry flow screenshots saved:')
  for (const row of verified) {
    console.log(`  ${row.path}  md5=${row.md5}  bytes=${row.bytes}`)
  }
} finally {
  preview.kill('SIGTERM')
}
