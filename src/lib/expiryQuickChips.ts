import { addDaysIso } from './dates.ts'

export const EXPIRY_QUICK_CHIPS = [
  { id: '+3d', label: '+3d', days: 3 },
  { id: '+1w', label: '+1w', days: 7 },
  { id: '+1m', label: '+1m', days: 30 },
  { id: '+6m', label: '+6m', days: 180 },
] as const

export function expiryFromQuickChip(days: number, from?: string): string {
  return addDaysIso(days, from)
}
