import { parseGs1Barcode } from './gs1Barcode.ts'
import type { PantryItem } from '../types.ts'

const DIGITS = /^\d+$/

/** Strip spaces/dashes; lift UPC-A (12 digits) to EAN-13 with a leading 0. */
export function normalizeBarcode(raw: string): string {
  const trimmed = raw.trim().replace(/[\s-]/g, '')
  if (!trimmed) return ''
  if (DIGITS.test(trimmed) && trimmed.length === 12) return `0${trimmed}`
  return trimmed
}

export function barcodesEqual(a: string, b: string): boolean {
  const left = normalizeBarcode(a)
  const right = normalizeBarcode(b)
  if (!left || !right) return false
  return left === right
}

export function findBarcodeMatch(
  items: readonly PantryItem[],
  barcode: string,
): PantryItem | undefined {
  const needle = normalizeBarcode(barcode)
  if (!needle) return undefined
  const matches = items.filter((item) => barcodesEqual(item.barcode, needle))
  matches.sort((a, b) => b.updatedAt - a.updatedAt)
  return matches[0]
}

export function isPlausibleBarcode(raw: string): boolean {
  const trimmed = raw.trim()
  if (parseGs1Barcode(trimmed)) return true
  const value = normalizeBarcode(trimmed)
  return /^[0-9A-Za-z]{6,20}$/.test(value)
}

export function barcodeSearchHaystack(barcode: string): string {
  const stored = barcode.trim().toLowerCase()
  const normalized = normalizeBarcode(barcode).toLowerCase()
  if (!stored) return ''
  return stored === normalized ? stored : `${stored} ${normalized}`
}
