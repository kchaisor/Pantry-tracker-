/**
 * Dry-run helper: suggest image_url values for pantry rows using the same bundled
 * slug map as the app (thumbnailCatalog.ts). Does not call Google APIs or touch a sheet.
 *
 * Usage:
 *   node scripts/backfill-image-urls.mjs
 *   node scripts/backfill-image-urls.mjs path/to/items-export.json
 *
 * Set PANTRY_THUMB_BASE to match your deployed app (default: GitHub Pages path).
 * To apply on a sheet, use Apps Script → Run → backfillImageUrls() in Code.gs on a copy first.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const root = join(dir, '..')
const catalogSource = readFileSync(join(root, 'src/lib/thumbnailCatalog.ts'), 'utf8')

const THUMB_BASE =
  process.env.PANTRY_THUMB_BASE?.replace(/\/?$/, '/') ||
  'https://kchaisor.github.io/Pantry-tracker-/thumbs/'

function parseRecordMap(exportName) {
  const marker = `export const ${exportName}`
  const start = catalogSource.indexOf(marker)
  if (start < 0) throw new Error(`Missing ${exportName} in thumbnailCatalog.ts`)
  const brace = catalogSource.indexOf('{', start)
  let depth = 0
  let end = brace
  for (; end < catalogSource.length; end++) {
    const ch = catalogSource[end]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) break
    }
  }
  const body = catalogSource.slice(brace + 1, end)
  const map = {}
  for (const m of body.matchAll(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g)) {
    map[m[1]] = m[2]
  }
  return map
}

const THUMB_BARCODE_SLUG = parseRecordMap('THUMB_BARCODE_SLUG')
const THUMB_ID_SLUG = parseRecordMap('THUMB_ID_SLUG')

function bundledUrl(slug) {
  return `${THUMB_BASE}${slug}.jpg`
}

function suggestUrl(item) {
  if (item.imageUrl?.trim() || item.image_url?.trim()) {
    return item.imageUrl?.trim() || item.image_url?.trim()
  }
  const byId = item.id && THUMB_ID_SLUG[item.id]
  if (byId) return bundledUrl(byId)
  const code = String(item.barcode || '').trim()
  if (code && THUMB_BARCODE_SLUG[code]) return bundledUrl(THUMB_BARCODE_SLUG[code])
  return ''
}

const inputPath = process.argv[2] || join(root, 'public/fixtures/pantry-live-items.json')
const payload = JSON.parse(readFileSync(inputPath, 'utf8'))
const items = Array.isArray(payload) ? payload : payload.items
if (!Array.isArray(items)) {
  console.error('Expected { items: [...] } or an array')
  process.exit(1)
}

const rows = items.map((item) => ({
  id: item.id,
  name: item.name,
  barcode: item.barcode || '',
  image_url: suggestUrl(item),
}))

console.log(JSON.stringify({ thumbBase: THUMB_BASE, rows }, null, 2))
