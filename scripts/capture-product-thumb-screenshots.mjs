#!/usr/bin/env node
/**
 * Capture before (main) / after (branch) thumb screenshots on separate builds.
 * Clears service worker + storage; uses thumb-compare fixture for the two replaced SKUs.
 */
import { spawn } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = '/opt/cursor/artifacts'
const workMain = '/tmp/pantry-screenshot-main'
const MAIN_PORT = 4183
const BRANCH_PORT = 4184

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))))
  })
}

async function waitForFixtureJson(port) {
  const url = `http://127.0.0.1:${port}/fixtures/pantry-thumb-compare.json`
  await waitForServer(url)
  const res = await fetch(url)
  const text = await res.text()
  if (!text.trimStart().startsWith('{')) {
    throw new Error(`Fixture JSON not served on port ${port}`)
  }
}

function waitForServer(url, timeoutMs = 45_000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url)
        if (res.ok) return resolve()
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) reject(new Error(`Server not ready: ${url}`))
      else setTimeout(tick, 250)
    }
    tick()
  })
}

async function prepareMainWorktree() {
  await run('git', ['worktree', 'remove', workMain, '--force'], { cwd: root }).catch(() => {})
  await run('git', ['worktree', 'prune'], { cwd: root }).catch(() => {})
  await rm(workMain, { recursive: true, force: true })
  await run('git', ['worktree', 'add', '--detach', workMain, 'main'], { cwd: root })
  await copyFile(
    path.join(root, 'public/fixtures/pantry-thumb-compare.json'),
    path.join(workMain, 'public/fixtures/pantry-thumb-compare.json'),
  )
  const appPath = path.join(workMain, 'src/App.tsx')
  let appSource = await readFile(appPath, 'utf8')
  if (!appSource.includes('thumb-compare')) {
    appSource = appSource.replace(
      "if (params.get('fixture') !== 'live') return\n    fixtureLoaded.current = true\n    void fetch(`${import.meta.env.BASE_URL}fixtures/pantry-live-items.json`)",
      "const fixture = params.get('fixture')\n    if (fixture !== 'live' && fixture !== 'thumb-compare') return\n    fixtureLoaded.current = true\n    const file =\n      fixture === 'thumb-compare'\n        ? 'fixtures/pantry-thumb-compare.json'\n        : 'fixtures/pantry-live-items.json'\n    void fetch(`${import.meta.env.BASE_URL}${file}`)",
    )
    await writeFile(appPath, appSource)
  }
  await run('npm', ['ci'], { cwd: workMain })
}

async function killPort(port) {
  await run('bash', [
    '-lc',
    `pkill -f "vite preview.*--port ${port}" 2>/dev/null || true; pkill -f "preview --host 127.0.0.1 --port ${port}" 2>/dev/null || true; sleep 1`,
  ]).catch(() => {})
}

async function buildAndPreview(cwd, port) {
  await killPort(port)
  await run('npm', ['run', 'build'], { cwd })
  const thumbPath = path.join(cwd, 'dist/thumbs/chung-jung-ssamjang.jpg')
  const { stat } = await import('node:fs/promises')
  const thumbSize = (await stat(thumbPath)).size
  console.log(`[${port}] chung-jung thumb bytes in dist:`, thumbSize)
  const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd,
    stdio: 'ignore',
  })
  await waitForFixtureJson(port)
  const served = await fetch(`http://127.0.0.1:${port}/thumbs/chung-jung-ssamjang.jpg`)
  const servedBytes = (await served.arrayBuffer()).byteLength
  console.log(`[${port}] chung-jung served bytes:`, servedBytes)
  return preview
}

async function captureSet(baseUrl, label) {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  })

  await context.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('pantry.welcome.seen', '1')
    localStorage.setItem('pantry.installHint.dismissed', '1')
    localStorage.setItem('pantry.viewMode', 'list')
  })

  const listPage = await context.newPage()
  await listPage.goto(`${baseUrl}?fixture=thumb-compare&view=list`, { waitUntil: 'networkidle' })
  await listPage.waitForSelector('text=Chung Jung One', { timeout: 25_000 })
  await listPage.waitForSelector('.studio-list-row', { timeout: 5_000 })
  await listPage.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('.studio-list-thumb .product-thumb'))
    return imgs.length >= 2 && imgs.every((img) => img.complete && img.naturalWidth > 0)
  })
  const thumbBytes = await listPage.evaluate(async () => {
    const img = document.querySelector('.studio-list-row .product-thumb')
    if (!(img instanceof HTMLImageElement) || !img.src || img.src.startsWith('data:')) return 0
    const res = await fetch(img.src)
    return (await res.arrayBuffer()).byteLength
  })
  console.log(`[${label}] list first-thumb payload bytes:`, thumbBytes)

  await listPage.locator('.studio-list-row').first().screenshot({
    path: path.join(outDir, `pantry-thumb-list-row-${label}.png`),
  })
  await listPage.screenshot({
    path: path.join(outDir, `pantry-thumb-list-${label}.png`),
    fullPage: false,
  })

  const cardPage = await context.newPage()
  await cardPage.addInitScript(() => {
    localStorage.setItem('pantry.viewMode', 'cards')
  })
  await cardPage.goto(`${baseUrl}?fixture=thumb-compare&view=cards`, { waitUntil: 'networkidle' })
  await cardPage.waitForSelector('.studio-card .product-thumb', { timeout: 20_000 })
  await cardPage.screenshot({
    path: path.join(outDir, `pantry-thumb-cards-${label}.png`),
    fullPage: false,
  })

  await browser.close()
}

async function capturePostScan(baseUrl, label) {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  })
  await context.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('pantry.welcome.seen', '1')
    localStorage.setItem('pantry.installHint.dismissed', '1')
  })
  const page = await context.newPage()
  await page.goto(`${baseUrl}?scanDemo=post-scan-sheet`, { waitUntil: 'load' })
  await page.waitForSelector('.post-scan-sheet', { timeout: 35_000 })
  await page.waitForSelector('text=La Española', { timeout: 15_000 })
  await page.waitForFunction(() => {
    const img = document.querySelector('.post-scan-thumb img')
    return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0 && !img.src.startsWith('data:')
  })
  await page.screenshot({
    path: path.join(outDir, `pantry-thumb-post-scan-${label}.png`),
    fullPage: false,
  })
  await browser.close()
}

await mkdir(outDir, { recursive: true })
await prepareMainWorktree()

const mainPreview = await buildAndPreview(workMain, MAIN_PORT)
const mainBase = `http://127.0.0.1:${MAIN_PORT}/`
try {
  await captureSet(mainBase, 'before-main')
  await capturePostScan(mainBase, 'before-main')
} finally {
  mainPreview.kill('SIGTERM')
}

const branchPreview = await buildAndPreview(root, BRANCH_PORT)
const branchBase = `http://127.0.0.1:${BRANCH_PORT}/`
try {
  await captureSet(branchBase, 'after-branch')
  await capturePostScan(branchBase, 'after-branch')
} finally {
  branchPreview.kill('SIGTERM')
}

console.log('Screenshots written to', outDir)
