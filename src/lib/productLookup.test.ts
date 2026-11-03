import { describe, expect, it } from 'vitest'
import { imageFromOff } from './productLookup.ts'

describe('imageFromOff', () => {
  it('prefers image_front_url over smaller OFF variants', () => {
    const url = imageFromOff({
      image_front_url: 'https://example.com/front.jpg',
      image_front_small_url: 'https://example.com/small.jpg',
      image_front_thumb_url: 'https://example.com/thumb.jpg',
      image_url: 'https://example.com/generic.jpg',
    })
    expect(url).toBe('https://example.com/front.jpg')
  })
})
