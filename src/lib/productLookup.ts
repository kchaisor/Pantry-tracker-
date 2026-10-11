import { CATEGORIES } from '../constants.ts'
import { normalizeBarcode } from './barcode.ts'
import { volumeFromProductFields } from './productVolume.ts'
import type { Category, ItemDraft } from '../types.ts'

export interface ProductLookup {
  name: string
  category: string
  brand: string
  isLiquid: boolean
  volumeMl: number | null
  volumeUnknown: boolean
}

const OFF_FIELDS =
  'product_name,product_name_en,generic_name,brands,categories_tags,quantity,product_quantity,product_quantity_unit'
const LOOKUP_MS = 4500

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

/**
 * Best-effort public UPC/EAN name lookup. Fails open: network, CORS, or
 * unknown codes just return null so Kelvin can type the name.
 */
export async function lookupProduct(barcode: string): Promise<ProductLookup | null> {
  const code = normalizeBarcode(barcode)
  if (!code || !/^\d{8,14}$/.test(code)) return null

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
