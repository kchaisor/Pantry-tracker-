import type { PpOcrAssetUrls } from '../lib/expiryOcrAssets.ts'

type OrtModule = {
  env: {
    wasm: {
      numThreads: number
      simd: boolean
      wasmPaths: Record<string, string>
    }
  }
  InferenceSession: {
    create(
      model: ArrayBuffer,
      options?: { executionProviders?: string[] },
    ): Promise<OrtInferenceSession>
  }
  Tensor: new (type: string, data: Float32Array, dims: number[]) => OrtTensor
}

type OrtTensor = {
  readonly dims: number[]
  readonly data: Float32Array
}

type OrtInferenceSession = {
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>
}

type InitMsg = { type: 'init'; assets: PpOcrAssetUrls }
type RunMsg = {
  type: 'run'
  id: number
  width: number
  height: number
  data: Float32Array
}
type WorkerIn = InitMsg | RunMsg

type WorkerOut =
  | { type: 'ready' }
  | { type: 'text'; id: number; text: string }
  | { type: 'error'; id?: number; message: string }

let ort: OrtModule | null = null
let session: OrtInferenceSession | null = null
let chars: string[] = ['']

function decodeRec(output: OrtTensor): string {
  const steps = output.dims[1] ?? 0
  const n = output.dims[2] ?? 0
  const data = output.data
  let text = ''
  let prev = -1
  for (let t = 0; t < steps; t++) {
    let best = 0
    for (let j = 1; j < n; j++) {
      if (data[t * n + j] > data[t * n + best]) best = j
    }
    if (best && best !== prev) text += chars[best] ?? ''
    prev = best
  }
  return text.trim()
}

async function ensureSession(assets: PpOcrAssetUrls): Promise<void> {
  if (session) return
  ort = (await import(/* @vite-ignore */ assets.ortWasmMjs)) as OrtModule
  ort.env.wasm.numThreads = 1
  ort.env.wasm.simd = true
  ort.env.wasm.wasmPaths = {
    'ort-wasm-simd-threaded.wasm': assets.ortWasm,
    'ort-wasm-simd-threaded.mjs': assets.ortWasmLoader,
  }
  const keysRes = await fetch(assets.recKeys)
  const keysJson = (await keysRes.json()) as { character: string }
  chars = ['', ...keysJson.character.split('\n'), ' ']
  const modelRes = await fetch(assets.recModel)
  const modelBuf = await modelRes.arrayBuffer()
  session = await ort.InferenceSession.create(modelBuf, { executionProviders: ['wasm'] })
}

self.onmessage = (event: MessageEvent<WorkerIn>) => {
  const msg = event.data
  void (async () => {
    try {
      if (msg.type === 'init') {
        await ensureSession(msg.assets)
        post({ type: 'ready' })
        return
      }
      if (msg.type === 'run') {
        if (!session || !ort) throw new Error('PP-OCR worker not ready')
        const tensor = new ort.Tensor('float32', msg.data, [1, 3, msg.height, msg.width])
        const out = Object.values(await session.run({ x: tensor }))[0]
        if (!out) throw new Error('Missing model output')
        const text = decodeRec(out)
        post({ type: 'text', id: msg.id, text })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PP-OCR failed'
      post({ type: 'error', id: msg.type === 'run' ? msg.id : undefined, message })
    }
  })()
}

function post(message: WorkerOut): void {
  self.postMessage(message)
}
