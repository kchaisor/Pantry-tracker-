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
  `${source}\nsandbox.mergeSyncItems = mergeSyncItems; sandbox.parseSyncTimestamp = parseSyncTimestamp; sandbox.parseExpiryDate = parseExpiryDate;`,
)
fn(sandbox)

const { mergeSyncItems, parseSyncTimestamp, parseExpiryDate } = sandbox

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

// #1: null rows from blank-name sheet lines must not crash merge
const withNull = mergeSyncItems([null, a[0]], b)
assert.equal(withNull.length, 1)
assert.equal(withNull[0].name, 'New')

// #2: Date cells and full epoch ms (not scientific display strings)
const epoch = 1_759_650_000_000
assert.equal(parseSyncTimestamp(epoch), epoch)
assert.equal(parseSyncTimestamp(new Date(epoch)), epoch)
const expiry = parseExpiryDate(new Date('2026-10-12T12:00:00Z'), '', 'UTC')
assert.equal(expiry, '2026-10-12')

console.log('apps-script/mergeLib.js merge + read helpers sanity check passed')
