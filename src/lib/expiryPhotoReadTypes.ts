export type ExpiryReadEngine = 'ppocr' | 'tesseract'

export type ExpiryReadLine = {
  engine: ExpiryReadEngine
  rawText: string
  iso: string | null
}

export type ExpiryConfirmChip = {
  iso: string
  label: string
  engines: ExpiryReadEngine[]
}

export type ExpiryPhotoReadResult =
  | {
      status: 'ok'
      cropPreviewUrl: string
      reads: ExpiryReadLine[]
      chips: ExpiryConfirmChip[]
    }
  | {
      status: 'empty'
      cropPreviewUrl: string
      reads: ExpiryReadLine[]
    }
  | { status: 'error'; message: string }
