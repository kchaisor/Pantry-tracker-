import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const postScanSource = readFileSync(
  fileURLToPath(new URL('./PostScanSheet.tsx', import.meta.url)),
  'utf8',
)

describe('PostScanSheet native date picker', () => {
  it('uses a tappable overlay date input instead of showPicker on a hidden field', () => {
    expect(postScanSource).toContain('type="date"')
    expect(postScanSource).toContain('expiry-native-date')
    expect(postScanSource).not.toContain('showPicker')
    expect(postScanSource).not.toContain('onPickDate')
  })
})
