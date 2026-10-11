import { describe, expect, it } from 'vitest'
import {
  convertVolumeToMl,
  isVolumeUnit,
  parseQuantityString,
  volumeFromProductFields,
} from './productVolume.ts'

describe('isVolumeUnit', () => {
  it('recognises metric volume units', () => {
    expect(isVolumeUnit('ml')).toBe(true)
    expect(isVolumeUnit('cL')).toBe(true)
    expect(isVolumeUnit('L')).toBe(true)
  })
  it('rejects mass units', () => {
    expect(isVolumeUnit('g')).toBe(false)
    expect(isVolumeUnit('kg')).toBe(false)
  })
})

describe('convertVolumeToMl', () => {
  it('converts L, cL, mL', () => {
    expect(convertVolumeToMl(1, 'L')).toBe(1000)
    expect(convertVolumeToMl(75, 'cL')).toBe(750)
    expect(convertVolumeToMl(682, 'ml')).toBe(682)
  })
})

describe('parseQuantityString', () => {
  it('parses common pack strings', () => {
    expect(parseQuantityString('682 ml')).toEqual({ isLiquid: true, volumeMl: 682 })
    expect(parseQuantityString('1 L')).toEqual({ isLiquid: true, volumeMl: 1000 })
    expect(parseQuantityString('75 cL')).toEqual({ isLiquid: true, volumeMl: 750 })
  })
  it('returns non-liquid for mass', () => {
    expect(parseQuantityString('500 g')).toEqual({ isLiquid: false, volumeMl: null })
  })
  it('marks liquid with unknown amount', () => {
    expect(parseQuantityString('ml')).toEqual({ isLiquid: false, volumeMl: null })
  })
})

describe('volumeFromProductFields', () => {
  it('uses product_quantity + unit', () => {
    expect(volumeFromProductFields('', 1000, 'ml')).toEqual({
      isLiquid: true,
      volumeMl: 1000,
    })
  })
  it('falls back to quantity string', () => {
    expect(volumeFromProductFields('682 ml', '', '')).toEqual({
      isLiquid: true,
      volumeMl: 682,
    })
  })
  it('liquid unit without numeric leaves volume unknown', () => {
    expect(volumeFromProductFields('', '', 'ml')).toEqual({
      isLiquid: true,
      volumeMl: null,
    })
  })
})
