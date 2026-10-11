/** Volume units from barcode catalog data (not product name). */
const VOLUME_UNIT = new Set(['ml', 'cl', 'dl', 'l', 'litre', 'liter', 'floz', 'fl oz', 'fl.oz'])

export interface ParsedVolume {
  /** True when the catalog unit is a volume measure. */
  isLiquid: boolean
  /** Pack volume in millilitres when known. */
  volumeMl: number | null
}

function normalizeVolumeUnit(raw: string): string {
  return raw.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, '')
}

export function isVolumeUnit(unit: string): boolean {
  const key = normalizeVolumeUnit(unit)
  if (VOLUME_UNIT.has(key)) return true
  if (key === 'millilitre' || key === 'milliliter' || key === 'millilitres' || key === 'milliliters') {
    return true
  }
  if (key === 'centilitre' || key === 'centiliter') return true
  if (key === 'litre' || key === 'liter' || key === 'litres' || key === 'liters') return true
  return false
}

export function convertVolumeToMl(amount: number, unit: string): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const key = normalizeVolumeUnit(unit)
  if (key === 'ml' || key === 'millilitre' || key === 'milliliter') return Math.round(amount)
  if (key === 'cl' || key === 'centilitre' || key === 'centiliter') return Math.round(amount * 10)
  if (key === 'dl') return Math.round(amount * 100)
  if (key === 'l' || key === 'litre' || key === 'liter' || key === 'litres' || key === 'liters') {
    return Math.round(amount * 1000)
  }
  if (key === 'floz') return Math.round(amount * 29.5735)
  return null
}

/** Parse strings like `682 ml`, `1 L`, `75 cL`, `1,5 L`. */
export function parseQuantityString(text: string): ParsedVolume {
  const trimmed = text.trim()
  if (!trimmed) return { isLiquid: false, volumeMl: null }

  const match = trimmed.match(/^([\d.,]+)\s*([a-zA-Z][a-zA-Z.\s]{0,12})$/)
  if (!match) return { isLiquid: false, volumeMl: null }

  const amountRaw = match[1].replace(',', '.')
  const amount = Number(amountRaw)
  const unit = match[2].trim()
  if (!isVolumeUnit(unit)) return { isLiquid: false, volumeMl: null }
  return { isLiquid: true, volumeMl: convertVolumeToMl(amount, unit) }
}

export function volumeFromProductFields(
  quantityText: string,
  productQuantity: unknown,
  productQuantityUnit: unknown,
): ParsedVolume {
  const unitRaw = typeof productQuantityUnit === 'string' ? productQuantityUnit : ''
  const qtyNum =
    typeof productQuantity === 'number'
      ? productQuantity
      : typeof productQuantity === 'string' && productQuantity.trim()
        ? Number(productQuantity.replace(',', '.'))
        : NaN

  if (unitRaw && isVolumeUnit(unitRaw)) {
    const volumeMl = convertVolumeToMl(qtyNum, unitRaw)
    return { isLiquid: true, volumeMl: volumeMl ?? parseQuantityString(quantityText).volumeMl }
  }

  const fromString = parseQuantityString(quantityText)
  if (fromString.isLiquid) return fromString

  if (unitRaw && isVolumeUnit(unitRaw)) {
    return { isLiquid: true, volumeMl: null }
  }

  return { isLiquid: false, volumeMl: null }
}
