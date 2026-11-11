#!/usr/bin/env node
/**
 * Resize a product image to 160×160 JPEG (matches public/thumbs/*.jpg).
 * Usage: node scripts/resize-thumb.mjs <input> <output>
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const [input, output] = process.argv.slice(2)
if (!input || !output || !existsSync(input)) {
  console.error('Usage: node scripts/resize-thumb.mjs <input> <output>')
  process.exit(1)
}

const vf =
  'scale=160:160:force_original_aspect_ratio=decrease,pad=160:160:(ow-iw)/2:(oh-ih)/2:color=white'
const result = spawnSync(
  'ffmpeg',
  ['-y', '-i', input, '-vf', vf, '-frames:v', '1', '-update', '1', '-q:v', '8', output],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
