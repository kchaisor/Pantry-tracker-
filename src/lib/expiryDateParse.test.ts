import { describe, expect, it } from 'vitest'
import { bestExpiryFromText, parseExpiryDatesFromText } from './expiryDateParse.ts'

describe('parseExpiryDatesFromText', () => {
  it('parses DD/MM/YYYY with BEST BEFORE prefix', () => {
    const hits = parseExpiryDatesFromText('BEST BEFORE 31/12/2026')
    expect(hits[0]?.iso).toBe('2026-12-31')
  })

  it('parses DD/MM/YY', () => {
    expect(bestExpiryFromText('Use by 05/11/26').best).toBe('2026-11-05')
  })

  it('parses DD.MM.YY', () => {
    expect(bestExpiryFromText('EXP 15.03.27').best).toBe('2027-03-15')
  })

  it('parses DD MMM YYYY', () => {
    expect(bestExpiryFromText('BB 7 Jan 2028').best).toBe('2028-01-07')
  })

  it('parses MMM YY as end of month', () => {
    expect(bestExpiryFromText('Best before DEC 25').best).toBe('2025-12-31')
  })

  it('parses USE BY with colon', () => {
    expect(bestExpiryFromText('USE BY: 01/02/2026').best).toBe('2026-02-01')
  })

  it('treats dates as day-first', () => {
    expect(bestExpiryFromText('12/03/2026').best).toBe('2026-03-12')
  })

  it('fixes O read as zero in OCR noise', () => {
    expect(bestExpiryFromText('BEST BEF0RE 1O/O3/26').best).toBe('2026-03-10')
  })

  it('handles missing separators in OCR', () => {
    const best = bestExpiryFromText('EXP 051126').best
    expect(best).toBe('2026-11-05')
  })

  it('finds multiple candidates and ranks prefixed lines', () => {
    const { best, alternatives } = bestExpiryFromText(
      'Lot 4421\nBest before 20/06/2026\nPacked 01/01/2026',
    )
    expect(best).toBe('2026-06-20')
    expect(alternatives.length).toBeGreaterThan(0)
  })

  it('returns empty for unrelated text', () => {
    expect(bestExpiryFromText('Ingredients: sugar, salt').best).toBeNull()
  })

  it('parses multiline noisy label', () => {
    expect(bestExpiryFromText('UB\n14  APR  27').best).toBe('2027-04-14')
  })
})
