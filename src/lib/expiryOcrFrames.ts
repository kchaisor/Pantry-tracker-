const MAX_FRAME_EDGE = 3200
const MAX_FRAMES = 22

export function maxOcrLongEdge(): number {
  return MAX_FRAME_EDGE
}

function cropCanvas(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, w)
  canvas.height = Math.max(1, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available.')
  ctx.drawImage(source, x, y, w, h, 0, 0, w, h)
  return canvas
}

function scaleCanvasUp(canvas: HTMLCanvasElement, minLongEdge: number): HTMLCanvasElement {
  const long = Math.max(canvas.width, canvas.height)
  if (long >= minLongEdge) return canvas
  const scale = minLongEdge / long
  const tw = Math.max(1, Math.round(canvas.width * scale))
  const th = Math.max(1, Math.round(canvas.height * scale))
  const out = document.createElement('canvas')
  out.width = tw
  out.height = th
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas not available.')
  ctx.imageSmoothingEnabled = scale >= 1
  if (scale >= 1) ctx.imageSmoothingQuality = 'high'
  else ctx.imageSmoothingEnabled = false
  ctx.drawImage(canvas, 0, 0, tw, th)
  return out
}

function rotateCanvas90(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = canvas.height
  out.height = canvas.width
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas not available.')
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  return out
}

export function enhanceCanvas(
  canvas: HTMLCanvasElement,
  contrast = 1.25,
  brightness = 1.05,
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas not available.')
  ctx.filter = `contrast(${contrast}) brightness(${brightness})`
  ctx.drawImage(canvas, 0, 0)
  return out
}

function scaleCanvasNearest(canvas: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(canvas.width * factor))
  out.height = Math.max(1, Math.round(canvas.height * factor))
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas not available.')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(canvas, 0, 0, out.width, out.height)
  return out
}

function dilateBinary(source: HTMLCanvasElement, passes = 1): HTMLCanvasElement {
  let current = source
  for (let p = 0; p < passes; p++) {
    const ctx = current.getContext('2d')
    if (!ctx) throw new Error('Canvas not available.')
    const { width, height } = current
    const src = ctx.getImageData(0, 0, width, height)
    const dst = new ImageData(width, height)
    const darkAt = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false
      const i = (y * width + x) * 4
      return src.data[i] < 128
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let dark = false
        for (let dy = -1; dy <= 1 && !dark; dy++) {
          for (let dx = -1; dx <= 1 && !dark; dx++) {
            if (darkAt(x + dx, y + dy)) dark = true
          }
        }
        const o = (y * width + x) * 4
        const v = dark ? 0 : 255
        dst.data[o] = dst.data[o + 1] = dst.data[o + 2] = v
        dst.data[o + 3] = 255
      }
    }
    const next = document.createElement('canvas')
    next.width = width
    next.height = height
    next.getContext('2d')!.putImageData(dst, 0, 0)
    current = next
  }
  return current
}

/** Upscale + threshold + dilate so inkjet dot stamps read as solid strokes for Tesseract. */
export function prepareDotMatrixInkCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const big = scaleCanvasNearest(source, 2)
  const contrasted = enhanceCanvas(big, 2.4, 0.92)
  const binary = binaryThresholdCanvas(contrasted, 155)
  return dilateBinary(binary, 2)
}

export function binaryThresholdCanvas(source: HTMLCanvasElement, cutoff = 150): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const sctx = source.getContext('2d')
  const octx = out.getContext('2d')
  if (!sctx || !octx) throw new Error('Canvas not available.')
  const img = sctx.getImageData(0, 0, source.width, source.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const v = lum > cutoff ? 255 : 0
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  octx.putImageData(img, 0, 0)
  return out
}

/** Edge strips + rotations for rim stamps; capped for mobile CPU. */
export function buildExpiryOcrCanvases(prepared: HTMLCanvasElement): HTMLCanvasElement[] {
  const w = prepared.width
  const h = prepared.height
  const frames: HTMLCanvasElement[] = []

  const push = (canvas: HTMLCanvasElement) => {
    frames.push(enhanceCanvas(canvas, 1.2, 1.04))
    frames.push(enhanceCanvas(canvas, 1.55, 1.08))
    const rotated = rotateCanvas90(canvas)
    frames.push(enhanceCanvas(rotated, 1.35, 1.05))
    frames.push(binaryThresholdCanvas(enhanceCanvas(rotated, 1.8, 0.95), 145))
  }

  const stampRim = cropCanvas(
    prepared,
    Math.round(w * 0.83),
    Math.round(h * 0.16),
    Math.max(80, Math.round(w * 0.17)),
    Math.round(h * 0.66),
  )
  const stampLine = rotateCanvas90(scaleCanvasUp(stampRim, 2600))
  frames.unshift(prepareDotMatrixInkCanvas(stampLine))
  frames.unshift(enhanceCanvas(stampLine, 2.1, 0.9))

  push(prepared)

  const rimW = Math.max(80, Math.round(w * 0.2))
  const rimCrop = cropCanvas(prepared, w - rimW, 0, rimW, h)
  const rimLine = rotateCanvas90(scaleCanvasUp(rimCrop, 2400))
  frames.push(enhanceCanvas(rimLine, 2, 0.92))
  frames.push(binaryThresholdCanvas(enhanceCanvas(rimLine, 2.2, 0.88), 140))
  frames.push(prepareDotMatrixInkCanvas(rimLine))

  const strips = [
    { x: 0, y: Math.round(h * 0.6), w, h: Math.round(h * 0.4) },
    { x: Math.round(w * 0.74), y: 0, w: Math.round(w * 0.26), h },
    { x: 0, y: 0, w: Math.round(w * 0.22), h },
    { x: Math.round(w * 0.55), y: Math.round(h * 0.1), w: Math.round(w * 0.45), h: Math.round(h * 0.8) },
    { x: Math.round(w * 0.65), y: Math.round(h * 0.2), w: Math.round(w * 0.35), h: Math.round(h * 0.55) },
  ]

  for (const s of strips) {
    if (frames.length >= MAX_FRAMES) break
    const crop = cropCanvas(prepared, s.x, s.y, s.w, s.h)
    push(scaleCanvasUp(crop, 1600))
  }

  return frames.slice(0, MAX_FRAMES)
}
