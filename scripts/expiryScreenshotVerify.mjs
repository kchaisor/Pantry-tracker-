import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

export const EXPIRY_CAPTURE_FILES = [
  'pantry-expiry-suggested.png',
  'pantry-expiry-chip.png',
  'pantry-expiry-ocr-confirm.png',
]

export async function md5File(filePath) {
  const buf = await readFile(filePath)
  return createHash('md5').update(buf).digest('hex')
}

/**
 * @param {string} outDir
 * @returns {Promise<{ path: string; md5: string; bytes: number }[]>}
 */
export async function verifyDistinctExpiryScreenshots(outDir) {
  const rows = []
  const hashes = new Set()

  for (const name of EXPIRY_CAPTURE_FILES) {
    const filePath = path.join(outDir, name)
    const info = await stat(filePath)
    if (!info.isFile() || info.size < 500) {
      throw new Error(`Missing or too small screenshot: ${filePath}`)
    }
    const md5 = await md5File(filePath)
    if (hashes.has(md5)) {
      throw new Error(`Duplicate screenshot content (md5 ${md5}): ${name}`)
    }
    hashes.add(md5)
    rows.push({ path: filePath, md5, bytes: info.size })
  }

  return rows
}
