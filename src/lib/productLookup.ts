import { CATEGORIES } from '../constants.ts'
import { normalizeBarcode } from './barcode.ts'
import { bundledThumbUrl } from './thumbnailCatalog.ts'
import { persistItemThumbnail } from './thumbnails.ts'
import { volumeFromProductFields } from './productVolume.ts'
import type { Category, ItemDraft } from '../types.ts'

export interface ProductLookup {
  name: string
  category: string
  brand: string
  isLiquid: boolean
  volumeMl: number | null
  volumeUnknown: boolean
  imageUrl?: string | null
}

const OFF_FIELDS =
  'product_name,product_name_en,generic_name,brands,categories_tags,quantity,product_quantity,product_quantity_unit,image_front_small_url,image_front_thumb_url,image_url'
const LOOKUP_MS = 4500

/** Offline-safe catalog hits (checked before network). */
export const BUILTIN_BARCODE_CATALOG: Record<string, ProductLookup> = {
  '8410660098804': {
    name: 'La Española Extra Virgin Olive Oil',
    brand: 'La Española',
    category: 'Pantry',
    isLiquid: true,
    volumeMl: 1000,
    volumeUnknown: false,
    imageUrl: bundledThumbUrl('la-espanola-olive-oil'),
  },
}

const CATEGORY_HINTS: { tag: string; category: Category }[] = [
  { tag: 'en:milks', category: 'Dairy' },
  { tag: 'en:cheeses', category: 'Dairy' },
  { tag: 'en:yogurts', category: 'Dairy' },
  { tag: 'en:dairies', category: 'Dairy' },
  { tag: 'en:eggs', category: 'Dairy' },
  { tag: 'en:meats', category: 'Meat & seafood' },
  { tag: 'en:seafood', category: 'Meat & seafood' },
  { tag: 'en:fishes', category: 'Meat & seafood' },
  { tag: 'en:breads', category: 'Bread' },
  { tag: 'en:frozen-foods', category: 'Frozen' },
  { tag: 'en:canned-foods', category: 'Canned' },
  { tag: 'en:beverages', category: 'Beverages' },
  { tag: 'en:snacks', category: 'Snacks' },
  { tag: 'en:breakfasts', category: 'Breakfast' },
  { tag: 'en:condiments', category: 'Condiments' },
  { tag: 'en:sauces', category: 'Condiments' },
  { tag: 'en:spices', category: 'Spices' },
  { tag: 'en:olive-oils', category: 'Pantry' },
  { tag: 'en:vegetable-oils', category: 'Pantry' },
  { tag: 'en:oils', category: 'Pantry' },
  { tag: 'en:groceries', category: 'Pantry' },
  { tag: 'en:plant-based-foods-and-beverages', category: 'Produce' },
  { tag: 'en:fruits', category: 'Produce' },
  { tag: 'en:vegetables', category: 'Produce' },
]

function firstName(product: Record<string, unknown>): string {
  const keys = ['product_name_en', 'product_name', 'generic_name'] as const
  for (const key of keys) {
    const value = product[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function mapCategory(tags: unknown): string {
  if (!Array.isArray(tags)) return ''
  const list = tags.filter((tag): tag is string => typeof tag === 'string')
  for (const hint of CATEGORY_HINTS) {
    if (list.includes(hint.tag)) return hint.category
  }
  return ''
}

function clipName(name: string): string {
  const compact = name.replace(/\s+/g, ' ').trim()
  if (compact.length <= 80) return compact
  return compact.slice(0, 80).trim()
}

export function primaryBrand(raw: string): string {
  const first = raw.split(',')[0]?.trim() ?? ''
  if (!first) return ''
  return first.length <= 40 ? first : first.slice(0, 40).trim()
}

export function imageFromOff(product: Record<string, unknown>): string | null {
  const keys = ['image_front_small_url', 'image_front_thumb_url', 'image_url'] as const
  for (const key of keys) {
    const value = product[key]
    if (typeof value === 'string' && value.startsWith('http')) return value
  }
  return null
}

export function productFromOff(product: Record<string, unknown>): ProductLookup | null {
  const name = clipName(firstName(product))
  if (!name) return null
  const brand = primaryBrand(typeof product.brands === 'string' ? product.brands : '')
  const category = mapCategory(product.categories_tags)
  const allowed = CATEGORIES.includes(category as Category) ? category : ''
  const quantityText = typeof product.quantity === 'string' ? product.quantity : ''
  const volume = volumeFromProductFields(
    quantityText,
    product.product_quantity,
    product.product_quantity_unit,
  )
  return {
    name,
    category: allowed,
    brand,
    isLiquid: volume.isLiquid,
    volumeMl: volume.volumeMl,
    volumeUnknown: volume.isLiquid && volume.volumeMl == null,
    imageUrl: imageFromOff(product),
  }
}

/** Fill empty draft fields after a barcode catalog hit (never overwrite typed values). */
export function applyLookupToDraft(draft: ItemDraft, found: ProductLookup): ItemDraft {
  const next: ItemDraft = { ...draft }
  if (!next.name.trim()) next.name = found.name
  if (!next.category.trim()) next.category = found.category
  if (!next.brand.trim()) next.brand = found.brand
  if (found.isLiquid && found.volumeMl != null) {
    next.quantity = found.volumeMl
    next.unit = 'ml'
  }
  return next
}

export function cacheLookupThumbnail(
  barcode: string,
  found: ProductLookup,
  itemId?: string,
): void {
  if (!found.imageUrl) return
  persistItemThumbnail({
    id: itemId,
    barcode,
    name: found.name,
    url: found.imageUrl,
  })
}

/**
 * Best-effort public UPC/EAN name lookup. Fails open: network, CORS, or
 * unknown codes just return null so Kelvin can type the name.
 */
export async function lookupProduct(barcode: string): Promise<ProductLookup | null> {
  const code = normalizeBarcode(barcode)
  if (!code || !/^\d{8,14}$/.test(code)) return null

  const builtin = BUILTIN_BARCODE_CATALOG[code]
  if (builtin) return builtin

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), LOOKUP_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const body = (await response.json()) as {
      status?: number
      product?: Record<string, unknown>
    }
    if (body.status !== 1 || !body.product) return null
    return productFromOff(body.product)
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

/** Best-effort name search on Open Food Facts (non-blocking enrichment). */
export async function searchProductByName(name: string): Promise<ProductLookup | null> {
  const term = name.trim()
  if (!term) return null

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=1&fields=${OFF_FIELDS}`
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), LOOKUP_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { products?: Record<string, unknown>[] }
    const product = body.products?.[0]
    if (!product) return null
    return productFromOff(product)
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}
