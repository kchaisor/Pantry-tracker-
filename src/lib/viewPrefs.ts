import { VIEW_MODE_KEY } from '../constants.ts'

export type PantryViewMode = 'cards' | 'list'

export function readViewMode(): PantryViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY)
    return raw === 'list' ? 'list' : 'cards'
  } catch {
    return 'cards'
  }
}

export function writeViewMode(mode: PantryViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}
