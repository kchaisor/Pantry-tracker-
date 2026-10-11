import { isPlausibleBarcode, normalizeBarcode } from './barcode.ts'
import { parseGs1Barcode } from './gs1Barcode.ts'

export type CameraFacing = 'environment' | 'user'
export type CameraPermission = 'granted' | 'denied' | 'prompt' | 'unknown'
export type CameraFailure =
  | 'denied'
  | 'missing'
  | 'insecure'
  | 'busy'
  | 'unsupported'
  | 'unknown'

interface DetectedBarcodeLike {
  rawValue: string
}

interface BarcodeDetectorLike {
  detect(image: ImageBitmapSource): Promise<DetectedBarcodeLike[]>
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

const PRODUCT_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'qr_code',
  'data_matrix',
] as const

let nativeDetector: BarcodeDetectorLike | null | undefined
let zxingReader: { decodeFromCanvas: (canvas: HTMLCanvasElement) => { getText(): string } } | null =
  null

function barcodeDetectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return ctor ?? null
}

export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

export async function queryCameraPermission(): Promise<CameraPermission> {
  try {
    const permissions = navigator.permissions
    if (!permissions?.query) return 'unknown'
    const status = await permissions.query({ name: 'camera' as PermissionName })
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export function classifyCameraError(error: unknown): CameraFailure {
  if (!cameraSupported()) return 'unsupported'
  if (!window.isSecureContext) return 'insecure'
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return name === 'SecurityError' && !window.isSecureContext ? 'insecure' : 'denied'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return 'missing'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'busy'
  }
  return 'unknown'
}

export async function startCameraStream(
  video: HTMLVideoElement,
  facing: CameraFacing,
): Promise<MediaStream> {
  if (!cameraSupported()) {
    throw Object.assign(new Error('Camera is not available in this browser.'), { name: 'NotFoundError' })
  }
  if (!window.isSecureContext) {
    throw Object.assign(new Error('Camera needs HTTPS.'), { name: 'SecurityError' })
  }

  const tryConstraints = async (videoConstraints: MediaTrackConstraints) => {
    return navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints })
  }

  let stream: MediaStream
  try {
    stream = await tryConstraints({
      facingMode: { ideal: facing },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'OverconstrainedError') {
      stream = await tryConstraints({ facingMode: { ideal: facing } })
    } else {
      throw error
    }
  }

  video.setAttribute('playsinline', 'true')
  video.setAttribute('autoplay', 'true')
  video.setAttribute('muted', 'true')
  video.playsInline = true
  video.muted = true
  video.srcObject = stream

  try {
    await video.play()
  } catch {
    /* iOS sometimes needs a second play after metadata */
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        video.removeEventListener('loadedmetadata', onReady)
        video
          .play()
          .then(() => resolve())
          .catch(reject)
      }
      video.addEventListener('loadedmetadata', onReady)
      window.setTimeout(onReady, 250)
    })
  }

  return stream
}

export function stopCameraStream(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}

export async function getNativeDetector(): Promise<BarcodeDetectorLike | null> {
  if (nativeDetector !== undefined) return nativeDetector
  const Ctor = barcodeDetectorCtor()
  if (!Ctor) {
    nativeDetector = null
    return null
  }
  try {
    const supported = Ctor.getSupportedFormats ? await Ctor.getSupportedFormats() : [...PRODUCT_FORMATS]
    const formats = PRODUCT_FORMATS.filter((format) => supported.includes(format))
    nativeDetector = new Ctor({ formats: formats.length > 0 ? [...formats] : [...PRODUCT_FORMATS] })
    return nativeDetector
  } catch {
    nativeDetector = null
    return null
  }
}

async function getZxingReader() {
  if (zxingReader) return zxingReader
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
  ])
  hints.set(DecodeHintType.TRY_HARDER, true)
  zxingReader = new BrowserMultiFormatReader(hints)
  return zxingReader
}

function acceptRaw(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (parseGs1Barcode(trimmed)) return trimmed
  const normalized = normalizeBarcode(trimmed)
  return isPlausibleBarcode(normalized) ? trimmed : null
}

function grabFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  band = false,
): boolean {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) return false
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  if (band) {
    const cropHeight = Math.max(80, Math.round(height * 0.38))
    const cropY = Math.round((height - cropHeight) / 2)
    canvas.width = width
    canvas.height = cropHeight
    ctx.drawImage(video, 0, cropY, width, cropHeight, 0, 0, width, cropHeight)
    return true
  }

  canvas.width = width
  canvas.height = height
  ctx.drawImage(video, 0, 0, width, height)
  return true
}

export async function detectFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const detector = await getNativeDetector()
  if (detector && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    try {
      const codes = await detector.detect(video)
      const hit = acceptRaw(codes[0]?.rawValue)
      if (hit) return hit
    } catch {
      /* keep going with ZXing */
    }
  }

  if (!grabFrame(video, canvas, true) && !grabFrame(video, canvas, false)) return null

  if (detector) {
    try {
      const codes = await detector.detect(canvas)
      const hit = acceptRaw(codes[0]?.rawValue)
      if (hit) return hit
    } catch {
      /* fall through */
    }
  }

  try {
    const reader = await getZxingReader()
    const result = reader.decodeFromCanvas(canvas)
    return acceptRaw(result.getText())
  } catch {
    if (!grabFrame(video, canvas, false)) return null
    try {
      const reader = await getZxingReader()
      const result = reader.decodeFromCanvas(canvas)
      return acceptRaw(result.getText())
    } catch {
      return null
    }
  }
}

export async function detectFromImageFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  const detector = await getNativeDetector()
  if (detector && bitmap) {
    try {
      const codes = await detector.detect(bitmap)
      const hit = acceptRaw(codes[0]?.rawValue)
      if (hit) {
        bitmap.close()
        return hit
      }
    } catch {
      /* try ZXing */
    }
  }
  bitmap?.close()

  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(image, 0, 0)
    if (detector) {
      try {
        const codes = await detector.detect(canvas)
        const hit = acceptRaw(codes[0]?.rawValue)
        if (hit) return hit
      } catch {
        /* ZXing next */
      }
    }
    const reader = await getZxingReader()
    return acceptRaw(reader.decodeFromCanvas(canvas).getText())
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read that photo.'))
    image.src = src
  })
}
