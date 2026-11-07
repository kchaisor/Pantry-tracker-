import { describe, expect, it } from 'vitest'
import { maxOcrLongEdge } from './expiryOcrFrames.ts'

describe('expiryOcrFrames', () => {
  it('caps long edge for phone photos', () => {
    expect(maxOcrLongEdge()).toBeGreaterThanOrEqual(2800)
  })
})
