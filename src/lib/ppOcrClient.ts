import { getPpOcrBrowserAssetUrls, type PpOcrAssetUrls } from './expiryOcrAssets.ts'
import type { PpOcrTensorPack } from './ppOcrPreprocess.ts'

let worker: Worker | null = null
let ready: Promise<void> | null = null
let nextId = 0
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>()

function attachWorker(w: Worker): void {
  w.onmessage = (ev: MessageEvent<{ type: string; id?: number; text?: string; message?: string }>) => {
    const msg = ev.data
    if (msg.type === 'ready') return
    if (msg.type === 'text' && msg.id != null && msg.text != null) {
      pending.get(msg.id)?.resolve(msg.text)
      pending.delete(msg.id)
      return
    }
    if (msg.type === 'error') {
      if (msg.id != null) {
        pending.get(msg.id)?.reject(new Error(msg.message ?? 'PP-OCR failed'))
        pending.delete(msg.id)
        return
      }
      for (const [, p] of pending) p.reject(new Error(msg.message ?? 'PP-OCR failed'))
      pending.clear()
    }
  }
}

export function ensurePpOcrWorker(assets: PpOcrAssetUrls = getPpOcrBrowserAssetUrls()): Promise<void> {
  if (ready) return ready
  worker = new Worker(new URL('../workers/ppOcrWorker.ts', import.meta.url), { type: 'module' })
  attachWorker(worker)
  ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('PP-OCR worker init timed out')), 120_000)
    const onReady = (ev: MessageEvent<{ type: string }>) => {
      if (ev.data.type === 'ready') {
        clearTimeout(timer)
        worker?.removeEventListener('message', onReady)
        resolve()
      }
    }
    worker?.addEventListener('message', onReady)
    worker?.postMessage({ type: 'init', assets })
  })
  return ready
}

export async function recognizeWithPpOcr(pack: PpOcrTensorPack): Promise<string> {
  await ensurePpOcrWorker()
  if (!worker) throw new Error('PP-OCR worker missing')
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker!.postMessage(
      { type: 'run', id, width: pack.width, height: pack.height, data: pack.data },
      [pack.data.buffer],
    )
  })
}
