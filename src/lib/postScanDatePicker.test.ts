import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const postScanSource = readFileSync(
  fileURLToPath(new URL('../components/PostScanSheet.tsx', import.meta.url)),
  'utf8',
)
const appSource = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8')

describe('PostScan expiry entry', () => {
  it('uses a visible date input instead of hidden showPicker', () => {
    expect(postScanSource).toMatch(/type="date"/)
    expect(postScanSource).not.toContain('onPickDate')
    expect(appSource).not.toContain('showPicker')
  })
})
