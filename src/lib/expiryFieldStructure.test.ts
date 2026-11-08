import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const expiryFieldSource = readFileSync(
  fileURLToPath(new URL('../components/ExpiryField.tsx', import.meta.url)),
  'utf8',
)

describe('ExpiryField structure', () => {
  it('does not wrap the Photo button in a label', () => {
    expect(expiryFieldSource).not.toMatch(/<label[^>]*>[\s\S]*expiry-photo-btn/)
    expect(expiryFieldSource).toContain('expiry-field-label')
  })
})
