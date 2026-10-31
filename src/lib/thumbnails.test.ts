import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { pantryToSyncItem } from './syncMerge.ts'
import { bundledThumbUrl, THUMB_BARCODE_SLUG } from './thumbnailCatalog.ts'
import {
  ITEM_THUMBNAILS_KEY,
  persistItemThumbnail,
  readThumbnailStore,
  resolveItemThumbnail,
  resolveThumbnailByBarcode,
  resolveThumbnailByName,
} from './thumbnails.ts'
import { normalizeName } from './query.ts'
import type { PantryItem } from '../types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(__dirname, '../../public/fixtures/pantry-live-items.json')
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as { items: PantryItem[] }

const lsStore: Record<string, string> = {}

beforeEach(() => {
  Object.keys(lsStore).forEach((k) => delete lsStore[k])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => lsStore[key] ?? null,
    setItem: (key: string, value: string) => {
      lsStore[key] = value
    },
    removeItem: (key: string) => {
      delete lsStore[key]
    },
  })
})

describe('curated live fixture thumbnails', () => {
  for (const item of fixture.items) {
    it(`resolves bundled thumb for ${item.name.slice(0, 40)}…`, () => {
      const url = resolveItemThumbnail(item)
      expect(url).toBeTruthy()
      expect(url).toContain('/thumbs/')
      expect(url).toMatch(/\.jpg$/)
    })
  }
})

describe('La Española barcode', () => {
  it('resolves by barcode', () => {
    const url = resolveThumbnailByBarcode('8410660098804')
    expect(url).toBe(bundledThumbUrl(THUMB_BARCODE_SLUG['8410660098804']))
  })
})

describe('localStorage pantry.itemThumbnails', () => {
  it('persists and reads by id, barcode, and name', () => {
    persistItemThumbnail({
      id: 'abc',
      barcode: '8410660098804',
      name: 'La Española Extra Virgin Olive Oil',
      url: 'https://example.com/img.jpg',
    })
    const store = readThumbnailStore()
    expect(store.byId.abc).toBe('https://example.com/img.jpg')
    expect(store.byBarcode['8410660098804']).toBe('https://example.com/img.jpg')
    expect(store.byName[normalizeName('La Española Extra Virgin Olive Oil')]).toBe(
      'https://example.com/img.jpg',
    )

    const item: PantryItem = {
      id: 'abc',
      name: 'La Española Extra Virgin Olive Oil',
      brand: '',
      quantity: 1,
      unit: 'ml',
      category: '',
      expiryDate: null,
      notes: '',
      lowStockThreshold: null,
      barcode: '8410660098804',
      createdAt: 0,
      updatedAt: 0,
    }
    expect(resolveItemThumbnail(item)).toBe('https://example.com/img.jpg')
    expect(resolveThumbnailByName('La Española Extra Virgin Olive Oil')).toBe(
      'https://example.com/img.jpg',
    )
  })

  it('does not mutate SyncItem / sheet payload keys', () => {
    const item: PantryItem = {
      id: 'x',
      name: 'Test',
      brand: 'B',
      quantity: 1,
      unit: 'ml',
      category: 'Pantry',
      expiryDate: null,
      notes: '',
      lowStockThreshold: null,
      barcode: '',
      createdAt: 1,
      updatedAt: 2,
    }
    persistItemThumbnail({ id: 'x', url: bundledThumbUrl('moro-olive-oil') })
    const sync = pantryToSyncItem(item)
    const itemWithImage: PantryItem = { ...item, imageUrl: bundledThumbUrl('moro-olive-oil') }
    const syncWithImage = pantryToSyncItem(itemWithImage)
    expect(Object.keys(syncWithImage).sort()).toEqual(
      [
        'barcode',
        'brand',
        'category',
        'createdAt',
        'deleted',
        'expiryDate',
        'id',
        'imageUrl',
        'lowStockThreshold',
        'name',
        'notes',
        'quantity',
        'unit',
        'updatedAt',
      ].sort(),
    )
    expect(Object.keys(sync).sort()).toEqual(
      [
        'barcode',
        'brand',
        'category',
        'createdAt',
        'deleted',
        'expiryDate',
        'id',
        'lowStockThreshold',
        'name',
        'notes',
        'quantity',
        'unit',
        'updatedAt',
      ].sort(),
    )
    expect(localStorage.getItem(ITEM_THUMBNAILS_KEY)).toContain('moro-olive-oil')
  })
})
