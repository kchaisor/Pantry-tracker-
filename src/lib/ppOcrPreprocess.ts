export const PP_OCR_REC_HEIGHT = 48

export type PpOcrTensorPack = {
  data: Float32Array
  width: number
  height: number
}

export function ppOcrTensorFromColorCanvas(canvas: HTMLCanvasElement): PpOcrTensorPack {
  const h = PP_OCR_REC_HEIGHT
  const w = Math.max(1, Math.floor((h * canvas.width) / canvas.height))
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const ctx = tmp.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(canvas, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const out = new Float32Array(3 * w * h)
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    out[i] = b / 127.5 - 1
    out[w * h + i] = g / 127.5 - 1
    out[2 * w * h + i] = r / 127.5 - 1
  }
  return { data: out, width: w, height: h }
}

export function thresholdDilateCanvas(
  source: HTMLCanvasElement,
  threshold = 130,
  dilate = 3,
): HTMLCanvasElement {
  const w = source.width
  const h = source.height
  const srcCtx = source.getContext('2d')
  if (!srcCtx) throw new Error('Canvas not available')
  const { data } = srcCtx.getImageData(0, 0, w, h)
  const gray = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    gray[i] = (r * 0.299 + g * 0.587 + b * 0.114) | 0
  }
  const bin = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) bin[i] = gray[i] < threshold ? 255 : 0
  if (dilate > 0) {
    const dil = new Uint8Array(w * h)
    const r = dilate
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let on = 0
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            if (bin[ny * w + nx]) on = 255
          }
        }
        dil[y * w + x] = on
      }
    }
    for (let i = 0; i < w * h; i++) bin[i] = dil[i]
  }
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const outCtx = out.getContext('2d')
  if (!outCtx) throw new Error('Canvas not available')
  const img = outCtx.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const v = bin[i]
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  outCtx.putImageData(img, 0, 0)
  return out
}
