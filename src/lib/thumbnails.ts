import { normalizeBarcode } from './barcode.ts'
import { normalizeName } from './query.ts'
import {
  bundledThumbUrl,
  slugForItem,
  slugForItemName,
  THUMB_BARCODE_SLUG,
} from './thumbnailCatalog.ts'
import type { PantryItem } from '../types.ts'

export const ITEM_THUMBNAILS_KEY = 'pantry.itemThumbnails'
/** Device-local user-captured or custom sheet URLs kept when catalog product art wins in the UI. */
export const USER_ITEM_PHOTOS_KEY = 'pantry.userItemPhotos'

export type VesselKind = 'bottle' | 'jar' | 'box' | 'roll' | 'pack' | 'spray' | 'stick' | 'tub'

interface ThumbnailStore {
  byId: Record<string, string>
  byBarcode: Record<string, string>
  byName: Record<string, string>
}

function emptyStore(): ThumbnailStore {
  return { byId: {}, byBarcode: {}, byName: {} }
}

export function readThumbnailStore(): ThumbnailStore {
  try {
    const raw = localStorage.getItem(ITEM_THUMBNAILS_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as ThumbnailStore
    return {
      byId: parsed.byId ?? {},
      byBarcode: parsed.byBarcode ?? {},
      byName: parsed.byName ?? {},
    }
  } catch {
    return emptyStore()
  }
}

export function writeThumbnailStore(store: ThumbnailStore): void {
  try {
    localStorage.setItem(ITEM_THUMBNAILS_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

export function persistItemThumbnail(entry: {
  id?: string
  barcode?: string
  name?: string
  url: string
}): void {
  const url = entry.url.trim()
  if (!url) return
  const store = readThumbnailStore()
  if (entry.id?.trim()) store.byId[entry.id.trim()] = url
  const code = entry.barcode ? normalizeBarcode(entry.barcode) : ''
  if (code) store.byBarcode[code] = url
  const nameKey = entry.name ? normalizeName(entry.name) : ''
  if (nameKey) store.byName[nameKey] = url
  writeThumbnailStore(store)
}

export function readUserPhotoStore(): Record<string, string> {
  try {
    const raw = localStorage.getItem(USER_ITEM_PHOTOS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function persistUserItemPhoto(id: string, url: string): void {
  const key = id.trim()
  const value = url.trim()
  if (!key || !value) return
  const store = readUserPhotoStore()
  if (store[key] === value) return
  store[key] = value
  try {
    localStorage.setItem(USER_ITEM_PHOTOS_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

/** Public product-shot hosts (OFF, bundled repo, major AU retail CDNs). */
export function isProductImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase()
  if (!u.startsWith('http')) return false
  if (u.includes('openfoodfacts.org')) return true
  if (u.includes('productimages.coles.com.au')) return true
  if (u.includes('/thumbs/') && u.endsWith('.jpg')) return true
  if (u.includes('cdn.shopify.com')) return true
  if (u.includes('contentstack.com')) return true
  if (u.includes('world.openfoodfacts.org')) return true
  return false
}

/**
 * Custom / user-origin image URLs (sheet column N, legacy cache, data URLs).
 * Catalog items with a bundled slug treat any other http URL as user-owned.
 */
export function isUserCapturedImageUrl(
  url: string,
  item?: Pick<PantryItem, 'id' | 'name' | 'barcode' | 'unit' | 'category' | 'imageUrl'>,
): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return true
  const slug = item ? slugForItem(item) : null
  if (slug) {
    const bundled = bundledThumbUrl(slug)
    if (trimmed === bundled) return false
    if (isProductImageUrl(trimmed)) return false
    return true
  }
  return !isProductImageUrl(trimmed)
}

function archiveUserPhotoIfNeeded(
  item: Pick<PantryItem, 'id' | 'name' | 'barcode' | 'unit' | 'category' | 'imageUrl'>,
): void {
  const url = item.imageUrl?.trim()
  if (!url || !item.id?.trim()) return
  if (!isUserCapturedImageUrl(url, item)) return
  persistUserItemPhoto(item.id, url)
}

/** Product URL for sheet sync (bundled / OFF), not the user-capture fallback. */
export function resolveCanonicalImageUrl(
  item: Pick<PantryItem, 'id' | 'name' | 'barcode' | 'unit' | 'category' | 'imageUrl'>,
): string | null {
  const slug = slugForItem(item)
  if (slug) return bundledThumbUrl(slug)
  const url = item.imageUrl?.trim()
  if (url && !isUserCapturedImageUrl(url, item)) return url
  return resolveItemThumbnail(item)
}

/**
 * Resolve thumbnail URL for list/card UI.
 * Priority: bundled catalog → product imageUrl / OFF cache → user photo (stored locally).
 */
export function resolveItemThumbnail(
  item: Pick<PantryItem, 'id' | 'name' | 'barcode' | 'unit' | 'category' | 'imageUrl'>,
): string | null {
  const slug = slugForItem(item)
  if (slug) {
    archiveUserPhotoIfNeeded(item)
    return bundledThumbUrl(slug)
  }

  const url = item.imageUrl?.trim()
  if (url && !isUserCapturedImageUrl(url, item)) return url

  const store = readThumbnailStore()
  if (item.id && store.byId[item.id]) return store.byId[item.id]
  const code = normalizeBarcode(item.barcode)
  if (code && store.byBarcode[code]) return store.byBarcode[code]
  const nameKey = normalizeName(item.name)
  if (nameKey && store.byName[nameKey]) return store.byName[nameKey]

  if (item.id) {
    const user = readUserPhotoStore()[item.id]
    if (user) return user
  }
  if (url && isUserCapturedImageUrl(url, item)) return url

  return null
}

export function resolveThumbnailByBarcode(barcode: string): string | null {
  const code = normalizeBarcode(barcode)
  if (!code) return null
  const slug = THUMB_BARCODE_SLUG[code]
  if (slug) return bundledThumbUrl(slug)
  const store = readThumbnailStore()
  if (store.byBarcode[code]) return store.byBarcode[code]
  return null
}

export function resolveThumbnailByName(name: string): string | null {
  const nameKey = normalizeName(name)
  if (!nameKey) return null
  const slug = slugForItemName(name)
  if (slug) return bundledThumbUrl(slug)
  const store = readThumbnailStore()
  if (store.byName[nameKey]) return store.byName[nameKey]
  return null
}

export function inferVesselKind(
  item: Pick<PantryItem, 'name' | 'unit' | 'category'>,
): VesselKind {
  const hay = `${item.name} ${item.unit} ${item.category}`.toLowerCase()
  if (/spray|aerosol/.test(hay)) return 'spray'
  if (/roll|foil|paper towel|toilet paper|bake/.test(hay)) return 'roll'
  if (/wipe|tissue|toilet|batter|pack|kleenex|quilton|handee|chux/.test(hay)) return 'pack'
  if (/box|powder|tablet|detergent washing/.test(hay)) return 'box'
  if (/jar|anchovy|chilli oil|paste(?! tub)/.test(hay)) return 'jar'
  if (/tub|ssamjang|doenjang|vanilla bean/.test(hay)) return 'tub'
  if (/stick|deodorant|roll-on/.test(hay)) return 'stick'
  if (/bottle|mouthwash|bleach|oil|sauce|saniti|dishwash|hand wash|rinse/.test(hay)) return 'bottle'
  const u = item.unit.toLowerCase()
  if (u === 'box') return 'box'
  if (u === 'roll') return 'roll'
  if (u === 'pack') return 'pack'
  if (u === 'jar') return 'jar'
  if (u === 'stick') return 'stick'
  if (u === 'bottle') return 'bottle'
  return 'bottle'
}

/** Non-blocking OFF enrichment (optional external URL). Skips when bundled thumb exists. */
export async function enrichThumbnailInBackground(
  item: PantryItem,
  lookup: (barcode: string) => Promise<{ imageUrl?: string | null } | null>,
  searchByName?: (name: string) => Promise<{ imageUrl?: string | null } | null>,
  onUrl?: (url: string) => void,
): Promise<string | null> {
  if (slugForItem(item) || item.imageUrl?.trim()) return null

  const code = normalizeBarcode(item.barcode)
  if (code) {
    const found = await lookup(code)
    if (found?.imageUrl) {
      persistItemThumbnail({ id: item.id, barcode: code, name: item.name, url: found.imageUrl })
      onUrl?.(found.imageUrl)
      return found.imageUrl
    }
  }

  if (searchByName && item.name.trim()) {
    const found = await searchByName(item.name)
    if (found?.imageUrl) {
      persistItemThumbnail({ id: item.id, barcode: code, name: item.name, url: found.imageUrl })
      onUrl?.(found.imageUrl)
      return found.imageUrl
    }
  }

  return null
}
