import { describe, expect, it } from 'vitest'
import { addDaysIso } from './dates.ts'
import { expiryPresetDays, type ExpiryPresetId } from './postScanPresets.ts'

describe('post-scan expiry presets', () => {
  const from = '2026-10-29'

  const cases: { id: ExpiryPresetId; days: number | null }[] = [
    { id: '+3d', days: 3 },
    { id: '+1w', days: 7 },
    { id: '+1m', days: 30 },
    { id: '+3m', days: 90 },
    { id: '+6m', days: 180 },
    { id: '+1y', days: 365 },
    { id: 'none', days: null },
  ]

  for (const { id, days } of cases) {
    it(`preset ${id}`, () => {
      const iso = expiryPresetDays(id, from)
      if (days == null) expect(iso).toBe('')
      else expect(iso).toBe(addDaysIso(days, from))
    })
  }
})
