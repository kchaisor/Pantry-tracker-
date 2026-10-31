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

/** Same URL the UI shows: stored imageUrl, cache, or bundled slug. */
export function resolveCanonicalImageUrl(
  item: Pick<PantryItem, 'id' | 'name' | 'barcode' | 'unit' | 'category' | 'imageUrl'>,
): string | null {
  if (item.imageUrl?.trim()) return item.imageUrl.trim()
  return resolveItemThumbnail(item)
}

/** Resolve thumbnail URL for an item (bundled assets preferred for known products). */
export function resolveItemThumbnail(
  item: Pick<PantryItem, 'id' | 'name' | 'barcode' | 'unit' | 'category' | 'imageUrl'>,
): string | null {
  if (item.imageUrl?.trim()) return item.imageUrl.trim()
  const store = readThumbnailStore()
  if (item.id && store.byId[item.id]) return store.byId[item.id]
  const code = normalizeBarcode(item.barcode)
  if (code && store.byBarcode[code]) return store.byBarcode[code]
  const nameKey = normalizeName(item.name)
  if (nameKey && store.byName[nameKey]) return store.byName[nameKey]

  const slug = slugForItem(item)
  if (slug) return bundledThumbUrl(slug)

  return null
}

export function resolveThumbnailByBarcode(barcode: string): string | null {
  const code = normalizeBarcode(barcode)
  if (!code) return null
  const store = readThumbnailStore()
  if (store.byBarcode[code]) return store.byBarcode[code]
  const slug = THUMB_BARCODE_SLUG[code]
  if (slug) return bundledThumbUrl(slug)
  return null
}

export function resolveThumbnailByName(name: string): string | null {
  const nameKey = normalizeName(name)
  if (!nameKey) return null
  const store = readThumbnailStore()
  if (store.byName[nameKey]) return store.byName[nameKey]
  const slug = slugForItemName(name)
  if (slug) return bundledThumbUrl(slug)
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
  if (item.imageUrl?.trim() || resolveItemThumbnail(item)) return null

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
