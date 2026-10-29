import { clampQuantity } from './query.ts'
import { parseQuantityString } from './productVolume.ts'
import { effectiveThreshold } from './stock.ts'
import { normalizeUnit } from './units.ts'
import type { PantryItem } from '../types.ts'

export const PACK_SIZE_OVERRIDES_KEY = 'pantry.packSizeOverrides'

export type FillFraction = 1 | 0.75 | 0.5 | 0.25 | 0

export const FRACTION_STEPS: FillFraction[] = [1, 0.75, 0.5, 0.25, 0]

export const FRACTION_LABELS: Record<FillFraction, string> = {
  1: 'Full',
  0.75: '¾',
  0.5: '½',
  0.25: '¼',
  0: 'Out',
}

const DISCRETE_UNITS = new Set([
  'pcs',
  'pack',
  'can',
  'bottle',
  'jar',
  'tub',
  'box',
  'roll',
  'stick',
  'bag',
  'cup',
  'oz',
  'lb',
])

/** Mass/volume units that use fill gauges and fraction pills. */
export function isContinuousUnit(unit: string): boolean {
  const n = normalizeUnit(unit)
  return n === 'ml' || n === 'L' || n === 'g' || n === 'kg'
}

export function isDiscreteUnit(unit: string): boolean {
  if (isContinuousUnit(unit)) return false
  const n = normalizeUnit(unit)
  return DISCRETE_UNITS.has(n) || !n
}

function readOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(PACK_SIZE_OVERRIDES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function readPackSizeOverride(itemId: string): number | null {
  const value = readOverrides()[itemId]
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function writePackSizeOverride(itemId: string, packSize: number | null): void {
  try {
    const map = readOverrides()
    if (packSize == null || packSize <= 0) {
      delete map[itemId]
    } else {
      map[itemId] = Math.round(packSize * 100) / 100
    }
    localStorage.setItem(PACK_SIZE_OVERRIDES_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/** Parse pack size from free text (name + notes), returned in the item's unit where possible. */
export function parsePackSizeFromText(text: string, unit: string): number | null {
  const normalized = normalizeUnit(unit)
  const haystack = text

  if (normalized === 'ml') {
    const mlMatch = haystack.match(/\b(\d+(?:[.,]\d+)?)\s*m[lL]\b/)
    if (mlMatch) return Number(mlMatch[1].replace(',', '.'))
    const lMatch = haystack.match(/\b(\d+(?:[.,]\d+)?)\s*[lL]\b/)
    if (lMatch) return Number(lMatch[1].replace(',', '.')) * 1000
    const parsed = parseQuantityString(haystack)
    if (parsed.volumeMl) return parsed.volumeMl
    return null
  }

  if (normalized === 'L') {
    const lMatch = haystack.match(/\b(\d+(?:[.,]\d+)?)\s*[lL]\b/)
    if (lMatch) return Number(lMatch[1].replace(',', '.'))
    const mlMatch = haystack.match(/\b(\d+(?:[.,]\d+)?)\s*m[lL]\b/)
    if (mlMatch) return Number(mlMatch[1].replace(',', '.')) / 1000
    return null
  }

  if (normalized === 'g') {
    const gMatch = haystack.match(/\b(\d+(?:[.,]\d+)?)\s*g\b(?!\/)/i)
    if (gMatch) return Number(gMatch[1].replace(',', '.'))
    const kgMatch = haystack.match(/\b(\d+(?:[.,]\d+)?)\s*kg\b/i)
    if (kgMatch) return Number(kgMatch[1].replace(',', '.')) * 1000
    return null
  }

  if (normalized === 'kg') {
    const kgMatch = haystack.match(/\b(\d+(?:[.,]\d+)?)\s*kg\b/i)
    if (kgMatch) return Number(kgMatch[1].replace(',', '.'))
    const gMatch = haystack.match(/\b(\d+(?:[.,]\d+)?)\s*g\b(?!\/)/i)
    if (gMatch) return Number(gMatch[1].replace(',', '.')) / 1000
    return null
  }

  return null
}

function defaultPackSizeFallback(item: Pick<PantryItem, 'quantity' | 'lowStockThreshold' | 'unit'>): number {
  const unit = normalizeUnit(item.unit)
  const threshold = effectiveThreshold(item)
  const qty = Math.max(0, item.quantity)

  if (unit === 'L') {
    return Math.max(qty, threshold > 0 ? threshold * 4 : 0, 1)
  }
  if (unit === 'kg') {
    return Math.max(qty, threshold > 0 ? threshold * 4 : 0, 1)
  }
  if (unit === 'ml' || unit === 'g') {
    return Math.max(qty, threshold > 0 ? threshold * 4 : 0, 500)
  }
  return Math.max(qty, 1)
}

export function inferPackSize(item: PantryItem, override?: number | null): number {
  if (override != null && override > 0) return override
  const stored = readPackSizeOverride(item.id)
  if (stored != null) return stored

  const fromText = parsePackSizeFromText(`${item.name} ${item.notes}`, item.unit)
  if (fromText != null && fromText > 0) return fromText

  return defaultPackSizeFallback(item)
}

export function quantityForFraction(packSize: number, fraction: FillFraction): number {
  if (fraction === 0) return 0
  return clampQuantity(packSize * fraction)
}

export function fillPercent(quantity: number, packSize: number): number {
  if (packSize <= 0) return 0
  return Math.min(100, Math.round((quantity / packSize) * 100))
}

export function nearestFraction(quantity: number, packSize: number): FillFraction {
  if (packSize <= 0 || quantity <= 0) return 0
  const ratio = quantity / packSize
  let best: FillFraction = 0
  let bestDist = Infinity
  for (const step of FRACTION_STEPS) {
    const dist = Math.abs(ratio - step)
    if (dist < bestDist) {
      bestDist = dist
      best = step
    }
  }
  return best
}

export function nextFractionQuantity(quantity: number, packSize: number): number {
  const current = nearestFraction(quantity, packSize)
  const idx = FRACTION_STEPS.indexOf(current)
  const next = FRACTION_STEPS[(idx + 1) % FRACTION_STEPS.length]
  return quantityForFraction(packSize, next)
}

export function fractionStatusLabel(quantity: number, packSize: number, low: boolean): string {
  if (quantity <= 0) return 'OUT'
  const pct = fillPercent(quantity, packSize)
  const frac = nearestFraction(quantity, packSize)
  if (low) return `LOW ${pct}%`
  if (frac === 1) return '100%'
  if (frac === 0.75) return `75% ${FRACTION_LABELS[0.75]}`
  if (frac === 0.5) return `50% ${FRACTION_LABELS[0.5]}`
  if (frac === 0.25) return `25% ${FRACTION_LABELS[0.25]}`
  return `${pct}%`
}

export function fillGaugeColor(quantity: number, packSize: number, tone: string): string {
  if (tone === 'empty' || tone === 'expired') return 'var(--crimson)'
  if (tone === 'low' || tone === 'soon') return 'var(--amber)'
  const pct = fillPercent(quantity, packSize)
  if (pct <= 25) return 'var(--amber)'
  return 'var(--herb)'
}

/** Convert catalog volume (mL) to quantity in item unit. */
export function volumeMlToUnitQuantity(volumeMl: number, unit: string): number {
  const n = normalizeUnit(unit)
  if (n === 'L') return volumeMl / 1000
  if (n === 'ml') return volumeMl
  if (n === 'kg') return volumeMl / 1000
  if (n === 'g') return volumeMl
  return volumeMl
}

export function packSizeFromVolumeMl(volumeMl: number, unit: string): number {
  return volumeMlToUnitQuantity(volumeMl, unit)
}
