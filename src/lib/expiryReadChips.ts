import { formatExpiryAu } from './expiryDateDisplay.ts'
import type { ExpiryConfirmChip, ExpiryReadEngine, ExpiryReadLine } from './expiryPhotoReadTypes.ts'

export function expiryConfirmChipsFromReads(reads: ExpiryReadLine[]): ExpiryConfirmChip[] {
  const dated = reads.filter((r): r is ExpiryReadLine & { iso: string } => r.iso != null)
  if (dated.length === 0) return []

  const byIso = new Map<string, ExpiryReadEngine[]>()
  for (const row of dated) {
    const list = byIso.get(row.iso) ?? []
    if (!list.includes(row.engine)) list.push(row.engine)
    byIso.set(row.iso, list)
  }

  const chips: ExpiryConfirmChip[] = []
  for (const [iso, engines] of byIso) {
    chips.push({ iso, label: formatExpiryAu(iso), engines })
  }

  chips.sort((a, b) => {
    const aAgreed = a.engines.length > 1
    const bAgreed = b.engines.length > 1
    if (aAgreed !== bAgreed) return aAgreed ? -1 : 1
    return a.iso.localeCompare(b.iso)
  })

  return chips
}
