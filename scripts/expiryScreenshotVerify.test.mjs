import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  EXPIRY_CAPTURE_FILES,
  md5File,
  verifyDistinctExpiryScreenshots,
} from './expiryScreenshotVerify.mjs'

describe('verifyDistinctExpiryScreenshots', () => {
  it('rejects byte-identical captures', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'expiry-cap-'))
    const payload = Buffer.from(`fake-png-same-bytes-${'x'.repeat(600)}`)
    for (const name of EXPIRY_CAPTURE_FILES) {
      await writeFile(path.join(dir, name), payload)
    }
    await assert.rejects(() => verifyDistinctExpiryScreenshots(dir), /Duplicate screenshot/)
  })

  it('accepts three distinct files', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'expiry-cap-'))
    for (let i = 0; i < EXPIRY_CAPTURE_FILES.length; i++) {
      await writeFile(path.join(dir, EXPIRY_CAPTURE_FILES[i]), Buffer.from(`distinct-${i}-${'x'.repeat(600)}`))
    }
    const rows = await verifyDistinctExpiryScreenshots(dir)
    assert.equal(rows.length, 3)
    const md5s = new Set(rows.map((r) => r.md5))
    assert.equal(md5s.size, 3)
  })

  it('md5File is stable', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'expiry-cap-'))
    const filePath = path.join(dir, 'one.png')
    await writeFile(filePath, Buffer.from('abc'))
    assert.equal(await md5File(filePath), await md5File(filePath))
  })
})
