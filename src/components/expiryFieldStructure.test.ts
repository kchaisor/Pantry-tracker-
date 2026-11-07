import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./ExpiryField.tsx', import.meta.url)), 'utf8')

describe('ExpiryField touch targets', () => {
  it('keeps the native date input outside a label that wraps the Photo button', () => {
    expect(source).toContain('expiry-date-input')
    expect(source).toContain('expiry-field-label')
    expect(source).not.toMatch(/<label[^>]*className="expiry-label-row"/)
  })
})
