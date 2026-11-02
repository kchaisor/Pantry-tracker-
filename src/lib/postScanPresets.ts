import { addDaysIso } from './dates.ts'
import { EXPIRY_QUICK_CHIPS } from './expiryQuickChips.ts'

export type ExpiryPresetId = (typeof EXPIRY_QUICK_CHIPS)[number]['id'] | 'clear'

const PRESET_DAYS: Record<ExpiryPresetId, number | null> = {
  '+3d': 3,
  '+1w': 7,
  '+1m': 30,
  '+6m': 180,
  clear: null,
}

export function expiryPresetDays(preset: ExpiryPresetId, from?: string): string {
  const days = PRESET_DAYS[preset]
  if (days == null) return ''
  return addDaysIso(days, from)
}

export const EXPIRY_PRESETS: { id: ExpiryPresetId; label: string }[] = [
  ...EXPIRY_QUICK_CHIPS.map((c) => ({ id: c.id, label: c.label })),
  { id: 'clear', label: 'Clear' },
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
