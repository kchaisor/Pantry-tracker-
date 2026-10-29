import { addDaysIso } from './dates.ts'

export type ExpiryPresetId =
  | '+3d'
  | '+1w'
  | '+1m'
  | '+3m'
  | '+6m'
  | '+1y'
  | 'none'

const PRESET_DAYS: Record<ExpiryPresetId, number | null> = {
  '+3d': 3,
  '+1w': 7,
  '+1m': 30,
  '+3m': 90,
  '+6m': 180,
  '+1y': 365,
  none: null,
}

export function expiryPresetDays(preset: ExpiryPresetId, from?: string): string {
  const days = PRESET_DAYS[preset]
  if (days == null) return ''
  return addDaysIso(days, from)
}

export const EXPIRY_PRESETS: { id: ExpiryPresetId; label: string }[] = [
  { id: '+3d', label: '+3d' },
  { id: '+1w', label: '+1w' },
  { id: '+1m', label: '+1m' },
  { id: '+3m', label: '+3m' },
  { id: '+6m', label: '+6m' },
  { id: '+1y', label: '+1y' },
  { id: 'none', label: 'No expiry' },
]

export const ZONE_PRESETS = ['Pantry', 'Fridge', 'Freezer', 'Household'] as const

export type ZonePreset = (typeof ZONE_PRESETS)[number]

export function mapCategoryToZone(category: string): ZonePreset {
  const c = category.trim().toLowerCase()
  if (c.includes('fridge') || c === 'dairy' || c === 'produce') return 'Fridge'
  if (c.includes('freez') || c === 'frozen') return 'Freezer'
  if (c.includes('kitchen') || c.includes('pantry') || c.includes('condiment')) return 'Pantry'
  return 'Household'
}
