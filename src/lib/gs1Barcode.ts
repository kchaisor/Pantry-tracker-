import { normalizeBarcode } from './barcode.ts'

const GS = '\u001d'

export interface Gs1ParseResult {
  gtin: string
  expiryDate: string | null
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** GS1 AI 17 (YYMMDD) → ISO date. DD=00 → last day of that month. */
export function parseGs1ExpiryYyMmDd(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 6) return null
  const yy = Number(digits.slice(0, 2))
  const mm = Number(digits.slice(2, 4))
  const dd = Number(digits.slice(4, 6))
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || mm < 1 || mm > 12) return null

  const year = yy >= 70 ? 1900 + yy : 2000 + yy
  let day = dd
  if (dd === 0) {
    day = new Date(year, mm, 0).getDate()
  } else if (dd < 1 || dd > 31) {
    return null
  }

  const iso = `${year}-${pad2(mm)}-${pad2(day)}`
  const check = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(check.getTime())) return null
  return iso
}

function normalizeGs1Payload(raw: string): string {
  return raw.trim().replace(/\[(\d{2})\]/g, '($1)')
}

function gtinFromDigits(digits: string): string {
  const cleaned = digits.replace(/\D/g, '')
  if (cleaned.length < 8) return ''
  const gtin14 = cleaned.slice(0, 14)
  return normalizeBarcode(gtin14.length === 14 ? gtin14 : cleaned)
}

function readFixedDigits(payload: string, start: number, len: number): string | null {
  const slice = payload.slice(start, start + len)
  if (slice.length < len || !/^\d+$/.test(slice)) return null
  return slice
}

function extractFromParentheses(payload: string): Gs1ParseResult | null {
  if (!payload.includes('(')) return null
  let gtin = ''
  let expiryDate: string | null = null
  const re = /\((\d{2})\)([^(\u001d]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(payload)) !== null) {
    const ai = match[1]
    const value = match[2].split(GS)[0]?.trim() ?? ''
    if (ai === '01') gtin = gtinFromDigits(value)
    if (ai === '17') expiryDate = parseGs1ExpiryYyMmDd(value)
  }
  if (!gtin && !expiryDate) return null
  return { gtin, expiryDate }
}

function extractFromLinear(payload: string): Gs1ParseResult | null {
  let gtin = ''
  let expiryDate: string | null = null
  let i = 0
  while (i < payload.length) {
    if (payload[i] === GS) {
      i += 1
      continue
    }
    const ai = payload.slice(i, i + 2)
    if (!/^\d{2}$/.test(ai)) break
    i += 2

    if (ai === '01') {
      const digits = readFixedDigits(payload, i, 14)
      if (!digits) break
      gtin = gtinFromDigits(digits)
      i += 14
      continue
    }
    if (ai === '17') {
      const digits = readFixedDigits(payload, i, 6)
      if (!digits) break
      expiryDate = parseGs1ExpiryYyMmDd(digits)
      i += 6
      continue
    }

    if (ai === '10' || ai === '21') {
      while (i < payload.length && payload[i] !== GS) i += 1
      continue
    }
    break
  }
  if (!gtin && !expiryDate) return null
  return { gtin, expiryDate }
}

/**
 * Parse GS1 element strings (QR / DataMatrix / GS1-128) for GTIN (AI 01) and expiry (AI 17).
 */
export function parseGs1Barcode(raw: string): Gs1ParseResult | null {
  const payload = normalizeGs1Payload(raw)
  if (!payload) return null

  if (payload.includes('(')) {
    return extractFromParentheses(payload)
  }

  const linear = payload.replace(/\s/g, '')
  if (linear.includes(GS) || /^01\d{14}/.test(linear)) {
    return extractFromLinear(linear)
  }

  const digitsOnly = linear.replace(/\D/g, '')
  if (digitsOnly.startsWith('01') && digitsOnly.length >= 16) {
    return extractFromLinear(digitsOnly)
  }

  return null
}

/** Normalize any scan (plain EAN or GS1) into pantry barcode + optional expiry. */
export function parseScannedCode(raw: string): { barcode: string; expiryDate: string | null } {
  const gs1 = parseGs1Barcode(raw)
  if (gs1?.gtin) {
    return { barcode: gs1.gtin, expiryDate: gs1.expiryDate }
  }
  if (gs1?.expiryDate) {
    return { barcode: normalizeBarcode(raw), expiryDate: gs1.expiryDate }
  }
  return { barcode: normalizeBarcode(raw), expiryDate: null }
}
