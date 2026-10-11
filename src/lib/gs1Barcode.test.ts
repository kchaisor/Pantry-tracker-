import { describe, expect, it } from 'vitest'
import { parseGs1Barcode, parseGs1ExpiryYyMmDd, parseScannedCode } from './gs1Barcode.ts'

describe('parseGs1ExpiryYyMmDd', () => {
  it('parses YYMMDD', () => {
    expect(parseGs1ExpiryYyMmDd('251231')).toBe('2025-12-31')
  })
  it('treats DD=00 as end of month', () => {
    expect(parseGs1ExpiryYyMmDd('250200')).toBe('2025-02-28')
    expect(parseGs1ExpiryYyMmDd('240229')).toBe('2024-02-29')
  })
})

describe('parseGs1Barcode', () => {
  const gtin14 = '08410660098804'

  it('parses parenthesised element string', () => {
    const hit = parseGs1Barcode(`(01)${gtin14}(17)251231`)
    expect(hit?.gtin).toBe('08410660098804')
    expect(hit?.expiryDate).toBe('2025-12-31')
  })

  it('parses FNC1/GS-separated payload', () => {
    const hit = parseGs1Barcode(`01${gtin14}\u001d17251231`)
    expect(hit?.gtin).toBe('08410660098804')
    expect(hit?.expiryDate).toBe('2025-12-31')
  })

  it('parses bracket AI markers', () => {
    const hit = parseGs1Barcode(`[01]${gtin14}[17]250630`)
    expect(hit?.gtin).toBe('08410660098804')
    expect(hit?.expiryDate).toBe('2025-06-30')
  })

  it('parses compact digit string', () => {
    const hit = parseGs1Barcode(`01${gtin14}17251231`)
    expect(hit?.expiryDate).toBe('2025-12-31')
  })
})

describe('parseScannedCode', () => {
  it('passes through plain EAN', () => {
    expect(parseScannedCode('8410660098804')).toEqual({
      barcode: '8410660098804',
      expiryDate: null,
    })
  })
})
