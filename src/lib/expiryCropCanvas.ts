export type CropTransform = {
  rotationQuarter: number
  cropNorm: { x: number; y: number; w: number; h: number }
}

export async function loadOrientedImageBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return await createImageBitmap(file)
  }
}

export function renderCropToCanvas(
  source: ImageBitmap,
  transform: CropTransform,
  maxSide = 2400,
): HTMLCanvasElement {
  const quarter = ((transform.rotationQuarter % 4) + 4) % 4
  const fullW = quarter % 2 === 0 ? source.width : source.height
  const fullH = quarter % 2 === 0 ? source.height : source.width

  const rotCanvas = document.createElement('canvas')
  rotCanvas.width = fullW
  rotCanvas.height = fullH
  const rotCtx = rotCanvas.getContext('2d')
  if (!rotCtx) throw new Error('Canvas not available')

  rotCtx.save()
  if (quarter === 1) {
    rotCtx.translate(fullW, 0)
    rotCtx.rotate(Math.PI / 2)
  } else if (quarter === 2) {
    rotCtx.translate(fullW, fullH)
    rotCtx.rotate(Math.PI)
  } else if (quarter === 3) {
    rotCtx.translate(0, fullH)
    rotCtx.rotate(-Math.PI / 2)
  }
  rotCtx.drawImage(source, 0, 0)
  rotCtx.restore()

  const { x, y, w, h } = transform.cropNorm
  const sx = Math.round(Math.max(0, Math.min(1, x)) * fullW)
  const sy = Math.round(Math.max(0, Math.min(1, y)) * fullH)
  const sw = Math.round(Math.max(0.02, Math.min(1, w)) * fullW)
  const sh = Math.round(Math.max(0.02, Math.min(1, h)) * fullH)

  let tw = sw
  let th = sh
  const scale = Math.min(1, maxSide / Math.max(sw, sh))
  tw = Math.max(1, Math.round(sw * scale))
  th = Math.max(1, Math.round(sh * scale))

  const out = document.createElement('canvas')
  out.width = tw
  out.height = th
  const outCtx = out.getContext('2d')
  if (!outCtx) throw new Error('Canvas not available')
  outCtx.drawImage(rotCanvas, sx, sy, sw, sh, 0, 0, tw, th)
  return out
}

export function canvasPreviewUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', 0.92)
}
