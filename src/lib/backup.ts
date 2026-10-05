import { APP_NAME } from '../constants.ts'
import type { BackupFile, PantryItem } from '../types.ts'
import { normalizeBarcode } from './barcode.ts'
import { clampQuantity } from './query.ts'

export function newId(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function asQuantity(value: unknown): number {
  if (typeof value === 'number') return clampQuantity(value)
  if (typeof value === 'string' && value.trim()) return clampQuantity(Number(value))
  return 0
}

function asThreshold(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.round(n * 100) / 100)
}

function asTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

export function normalizeItem(raw: unknown, now = Date.now()): PantryItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const name = asString(row.name).trim()
  if (!name) return null

  const expiryRaw = row.expiryDate
  let expiryDate: string | null = null
  if (typeof expiryRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expiryRaw)) {
    expiryDate = expiryRaw
  }

  const deletedRaw = row.deleted
  const deleted =
    deletedRaw === true ||
    deletedRaw === 1 ||
    (typeof deletedRaw === 'string' &&
      ['true', '1', 'yes'].includes(deletedRaw.trim().toLowerCase()))

  const item: PantryItem = {
    id: asString(row.id).trim() || newId(),
    name,
    quantity: asQuantity(row.quantity),
    unit: asString(row.unit, 'pcs').trim() || 'pcs',
    category: asString(row.category).trim(),
    expiryDate,
    notes: asString(row.notes).trim(),
    lowStockThreshold: asThreshold(row.lowStockThreshold),
    barcode: normalizeBarcode(asString(row.barcode)),
    createdAt: asTimestamp(row.createdAt, now),
    updatedAt: asTimestamp(row.updatedAt, now),
  }
  if (deleted) item.deleted = true
  return item
}

export function parseBackup(json: string): { items: PantryItem[]; exportedAt: string | null } {
  const parsed: unknown = JSON.parse(json)
  let rows: unknown[] = []
  let exportedAt: string | null = null

  if (Array.isArray(parsed)) {
    rows = parsed
  } else if (parsed && typeof parsed === 'object') {
    const file = parsed as Partial<BackupFile> & { items?: unknown }
    if (typeof file.exportedAt === 'string') exportedAt = file.exportedAt
    if (Array.isArray(file.items)) rows = file.items
  }

  const items = rows
    .map((row) => normalizeItem(row))
    .filter((item): item is PantryItem => item !== null)

  if (items.length === 0) {
    throw new Error('No pantry items found in that file.')
  }

  return { items, exportedAt }
}

export function toBackupFile(items: PantryItem[]): BackupFile {
  return {
    app: 'pantry',
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  }
}

export function toBackupJson(items: PantryItem[]): string {
  return `${JSON.stringify(toBackupFile(items), null, 2)}\n`
}

function csvCell(value: string | number | null): string {
  const text = value == null ? '' : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function toBackupCsv(items: PantryItem[]): string {
  const header = [
    'id',
    'name',
    'quantity',
    'unit',
    'category',
    'expiryDate',
    'notes',
    'lowStockThreshold',
    'barcode',
    'createdAt',
    'updatedAt',
  ]
  const lines = [header.join(',')]
  for (const item of items) {
    lines.push(
      [
        csvCell(item.id),
        csvCell(item.name),
        csvCell(item.quantity),
        csvCell(item.unit),
        csvCell(item.category),
        csvCell(item.expiryDate),
        csvCell(item.notes),
        csvCell(item.lowStockThreshold),
        csvCell(item.barcode),
        csvCell(item.createdAt),
        csvCell(item.updatedAt),
      ].join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export async function shareOrDownload(filename: string, text: string, mime: string): Promise<void> {
  const blob = new Blob([text], { type: mime })
  const file = new File([blob], filename, { type: mime })
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }

  try {
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: `${APP_NAME} backup` })
      return
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function backupStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
