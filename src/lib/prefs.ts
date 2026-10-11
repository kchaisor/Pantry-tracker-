import {
  ALERT_PREFS_KEY,
  BANNER_DISMISS_KEY,
  LAST_ADD_KEY,
  MAX_RECENTS,
  RECENTS_KEY,
} from '../constants.ts'
import { todayIso } from './dates.ts'
import type { AlertPrefs, LastAddPrefs, RecentItem } from '../types.ts'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode */
  }
}

export function readLastAdd(): LastAddPrefs | null {
  const value = readJson<LastAddPrefs | null>(LAST_ADD_KEY, null)
  if (!value || typeof value.unit !== 'string') return null
  return { unit: value.unit, category: value.category ?? '' }
}

export function writeLastAdd(prefs: LastAddPrefs): void {
  writeJson(LAST_ADD_KEY, prefs)
}

export function readRecents(): RecentItem[] {
  const value = readJson<RecentItem[]>(RECENTS_KEY, [])
  if (!Array.isArray(value)) return []
  return value
    .filter((entry) => entry && typeof entry.name === 'string' && entry.name.trim())
    .map((entry) => ({
      name: entry.name.trim(),
      brand: typeof entry.brand === 'string' ? entry.brand.trim() : '',
      unit: typeof entry.unit === 'string' ? entry.unit : 'pcs',
      category: typeof entry.category === 'string' ? entry.category : '',
    }))
    .slice(0, MAX_RECENTS)
}

export function rememberRecent(entry: RecentItem): RecentItem[] {
  const name = entry.name.trim()
  if (!name) return readRecents()
  const next = [
    { name, brand: entry.brand || '', unit: entry.unit, category: entry.category },
    ...readRecents().filter((item) => item.name.toLowerCase() !== name.toLowerCase()),
  ].slice(0, MAX_RECENTS)
  writeJson(RECENTS_KEY, next)
  return next
}

export function readAlertPrefs(): AlertPrefs {
  const value = readJson<AlertPrefs>(ALERT_PREFS_KEY, { notifyOnOpen: false })
  return { notifyOnOpen: Boolean(value?.notifyOnOpen) }
}

export function writeAlertPrefs(prefs: AlertPrefs): void {
  writeJson(ALERT_PREFS_KEY, prefs)
}

interface BannerDismiss {
  key: string
  day: string
}

export function isBannerDismissed(key: string): boolean {
  if (!key) return true
  const stored = readJson<BannerDismiss | null>(BANNER_DISMISS_KEY, null)
  if (!stored) return false
  return stored.key === key && stored.day === todayIso()
}

export function dismissBanner(key: string): void {
  writeJson(BANNER_DISMISS_KEY, { key, day: todayIso() })
}
