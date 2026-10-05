import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(dir, '../apps-script/mergeLib.js'), 'utf8').replace(
  /if \(typeof module[\s\S]*$/,
  '',
)

const sandbox = {}
const fn = new Function(
  'sandbox',
  `${source}\nsandbox.mergeSyncItems = mergeSyncItems; sandbox.parseSyncTimestamp = parseSyncTimestamp;`,
)
fn(sandbox)

const { mergeSyncItems } = sandbox

const a = [
  {
    id: 'x',
    name: 'Old',
    quantity: 1,
    unit: 'pcs',
    category: '',
    expiryDate: null,
    notes: '',
    lowStockThreshold: null,
    barcode: '',
    createdAt: 1,
    updatedAt: 100,
    deleted: false,
  },
]

const b = [
  {
    id: 'x',
    name: 'New',
    quantity: 2,
    unit: 'pcs',
    category: '',
    expiryDate: null,
    notes: '',
    lowStockThreshold: null,
    barcode: '',
    createdAt: 1,
    updatedAt: 200,
    deleted: false,
  },
]

const merged = mergeSyncItems(a, b)
assert.equal(merged.length, 1)
assert.equal(merged[0].name, 'New')
console.log('apps-script/mergeLib.js merge sanity check passed')
