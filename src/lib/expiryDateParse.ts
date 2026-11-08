const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

export interface ExpiryParseCandidate {
  iso: string
  score: number
  snippet: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const probe = new Date(year, month - 1, day)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null
  }
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function expandYear(twoOrFour: number): number {
  if (twoOrFour >= 100) return twoOrFour
  return twoOrFour >= 70 ? 1900 + twoOrFour : 2000 + twoOrFour
}

function validYearDigits(raw: string): boolean {
  return raw.length === 2 || raw.length === 4
}

function normalizeOcrText(raw: string): string {
  return raw
    .replace(/\r/g, '\n')
    .replace(/bef0re/gi, 'before')
    .replace(/(\d)[oO](\d)/g, '$10$2')
    .replace(/(\d)[oO](?=[-./])/g, '$10')
    .replace(/[oO](?=\d)/g, '0')
    .replace(/(\d)[|Il](\d)/g, '$11$2')
    .replace(/\s+/g, ' ')
    .trim()
}

function monthFromToken(token: string): number | null {
  const key = token.toLowerCase().replace(/\./g, '').slice(0, 3)
  return MONTHS[key] ?? null
}

function pushCandidate(
  out: ExpiryParseCandidate[],
  iso: string | null,
  score: number,
  snippet: string,
): void {
  if (!iso) return
  const existing = out.find((c) => c.iso === iso)
  if (existing) {
    existing.score = Math.max(existing.score, score)
    return
  }
  out.push({ iso, score, snippet })
}

function digitBounded(line: string, start: number, end: number): boolean {
  const before = start > 0 ? line[start - 1] : ' '
  const after = end < line.length ? line[end] : ' '
  return !/\d/.test(before) && !/\d/.test(after)
}

function parseNumericDates(line: string, out: ExpiryParseCandidate[], baseScore: number): void {
  const slash = /\b(\d{1,2})\s*[/.\\-]\s*(\d{1,2})\s*[/.\\-]\s*(\d{2,4})\b/g
  let m: RegExpExecArray | null
  while ((m = slash.exec(line))) {
    const yDigits = m[3]
    if (!validYearDigits(yDigits)) continue
    const d = Number(m[1])
    const mo = Number(m[2])
    const y = expandYear(Number(yDigits))
    pushCandidate(out, toIso(y, mo, d), baseScore + 10, m[0])
  }

  const spaced = /\b(\d{1,2})\s+(\d{1,2})\s+(\d{2,4})\b/g
  while ((m = spaced.exec(line))) {
    const yDigits = m[3]
    if (!validYearDigits(yDigits)) continue
    const d = Number(m[1])
    const mo = Number(m[2])
    if (d > 31 || mo > 12) continue
    const y = expandYear(Number(yDigits))
    pushCandidate(out, toIso(y, mo, d), baseScore + 9, m[0])
  }

  const compact = /\b(\d{2})(\d{2})(\d{2,4})\b/g
  while ((m = compact.exec(line))) {
    if (!digitBounded(line, m.index, m.index + m[0].length)) continue
    const yDigits = m[3]
    if (!validYearDigits(yDigits)) continue
    if (m[0].length === 8 && yDigits.length !== 4) continue
    const d = Number(m[1])
    const mo = Number(m[2])
    const y = expandYear(Number(yDigits))
    if (y < 2010 || y > 2099) continue
    if (d <= 31 && mo <= 12) {
      pushCandidate(out, toIso(y, mo, d), baseScore + 4, m[0])
    }
  }
}

function parseMonthYear(line: string, out: ExpiryParseCandidate[], baseScore: number): void {
  const re = /\b([A-Za-z]{3})\.?\s*['']?(\d{2,4})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    const yDigits = m[2]
    if (!validYearDigits(yDigits)) continue
    const month = monthFromToken(m[1])
    if (!month) continue
    const y = expandYear(Number(yDigits))
    const lastDay = new Date(y, month, 0).getDate()
    pushCandidate(out, toIso(y, month, lastDay), baseScore + 6, m[0])
  }
}

function parseDayMonthYearWords(line: string, out: ExpiryParseCandidate[], baseScore: number): void {
  const re = /\b(\d{1,2})\s+([A-Za-z]{3})\.?\s+(\d{2,4})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    const yDigits = m[3]
    if (!validYearDigits(yDigits)) continue
    const d = Number(m[1])
    const month = monthFromToken(m[2])
    if (!month) continue
    const y = expandYear(Number(yDigits))
    pushCandidate(out, toIso(y, month, d), baseScore + 12, m[0])
  }
}

const PREFIX =
  /(?:best\s*before|use\s*by|exp(?:iry)?|bb|ub)\s*[:.]?\s*/gi

function stripExpiryPrefix(line: string): { stripped: string; hasPrefix: boolean } {
  const stripped = line.replace(PREFIX, '')
  return { stripped, hasPrefix: stripped.length < line.length }
}

function trimAfterFirstSlashDate(line: string): string {
  const m = /(\d{1,2}\s*[/.\\-]\s*\d{1,2}\s*[/.\\-]\s*\d{2,4})/.exec(line)
  if (!m || m.index == null) return line
  return line.slice(0, m.index + m[0].length)
}

/**
 * Extract AU-style expiry dates from OCR or label text (day-first).
 */
export function parseExpiryDatesFromText(raw: string): ExpiryParseCandidate[] {
  const text = normalizeOcrText(raw)
  if (!text) return []

  const out: ExpiryParseCandidate[] = []
  const lines = text.split(/\n|;/)

  for (const line of lines) {
    const lower = line.toLowerCase()
    const noise =
      /\b(packed|lot|mfg|manufact|batch)\b/.test(lower) && !/\b(best|use|exp|bb|ub)\b/.test(lower)
    const lotTail = /\b(?:lot|batch|mfg|packed)\b/i
    const lotSplit = line.search(lotTail)
    const primaryLine = lotSplit > 0 ? line.slice(0, lotSplit) : line
    const datedSlice = trimAfterFirstSlashDate(primaryLine)
    const { stripped, hasPrefix } = stripExpiryPrefix(datedSlice)
    let base = hasPrefix ? 14 : 0
    if (noise) base -= 10
    parseNumericDates(stripped, out, base)
    parseDayMonthYearWords(stripped, out, base)
    parseMonthYear(stripped, out, base)
    if (hasPrefix && primaryLine !== line) {
      parseNumericDates(primaryLine, out, base)
      parseDayMonthYearWords(primaryLine, out, base)
    }
  }

  const textForCompact = text
    .split(/\n|;/)
    .map((line) => trimAfterFirstSlashDate(line))
    .join('\n')
  parseNumericDates(textForCompact, out, 0)
  parseDayMonthYearWords(text, out, 0)

  out.sort((a, b) => b.score - a.score || b.iso.localeCompare(a.iso))
  return out
}

export function bestExpiryFromText(raw: string): {
  best: string | null
  alternatives: string[]
} {
  const ranked = parseExpiryDatesFromText(raw)
  if (ranked.length === 0) return { best: null, alternatives: [] }
  const best = ranked[0].iso
  const alternatives = ranked.slice(1, 4).map((c) => c.iso)
  return { best, alternatives }
}
