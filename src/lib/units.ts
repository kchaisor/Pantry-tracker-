import type { Unit } from '../types.ts'

/** Canonical storage for millilitres (legacy rows may use `mL`). */
export function normalizeUnit(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'pcs'
  if (/^ml$/i.test(trimmed)) return 'ml'
  return trimmed
}

export function unitLabel(unit: string): string {
  if (unit === 'ml') return 'mL'
  return unit
}

export function isMillilitreUnit(unit: string): boolean {
  return normalizeUnit(unit) === 'ml'
}

export function isKnownUnit(unit: string): unit is Unit {
  const normalized = normalizeUnit(unit)
  return (
    normalized === unit ||
    normalized === 'ml' ||
    [
      'pcs',
      'oz',
      'lb',
      'g',
      'kg',
      'ml',
      'L',
      'cup',
      'can',
      'box',
      'bag',
      'bottle',
      'jar',
      'pack',
    ].includes(normalized)
  )
}
