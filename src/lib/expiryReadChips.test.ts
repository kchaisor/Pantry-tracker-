import { describe, expect, it } from 'vitest'
import { expiryConfirmChipsFromReads } from './expiryReadChips.ts'

describe('expiryConfirmChipsFromReads', () => {
  it('shows one chip when both readers agree', () => {
    const chips = expiryConfirmChipsFromReads([
      { engine: 'ppocr', rawText: '27/01/2027', iso: '2027-01-27' },
      { engine: 'tesseract', rawText: '27/01/2027', iso: '2027-01-27' },
    ])
    expect(chips).toHaveLength(1)
    expect(chips[0]?.iso).toBe('2027-01-27')
    expect(chips[0]?.engines).toEqual(['ppocr', 'tesseract'])
    expect(chips[0]?.label).toBe('27 Jan 2027')
  })

  it('shows competing chips when readers disagree', () => {
    const chips = expiryConfirmChipsFromReads([
      { engine: 'ppocr', rawText: '27/01/2027', iso: '2027-01-27' },
      { engine: 'tesseract', rawText: '20/01/2027', iso: '2027-01-20' },
    ])
    expect(chips).toHaveLength(2)
    expect(chips.map((c) => c.iso).sort()).toEqual(['2027-01-20', '2027-01-27'])
  })

  it('returns empty when no reader parsed a date', () => {
    expect(
      expiryConfirmChipsFromReads([
        { engine: 'ppocr', rawText: 'noise', iso: null },
        { engine: 'tesseract', rawText: 'noise', iso: null },
      ]),
    ).toEqual([])
  })
})
