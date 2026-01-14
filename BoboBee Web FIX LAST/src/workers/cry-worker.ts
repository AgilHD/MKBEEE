/// <reference lib="webworker" />

import { loadTmAudioModel, predictFromFloat32Mono } from '../ml/tm-audio/model'

type MsgIn =
  | { type: 'init'; baseUrl?: string }
  | { type: 'predict'; samples: ArrayBuffer; sampleRate: number }

type MsgOut =
  | { type: 'ready' }
  | { type: 'pred'; label: string; probs: Record<string, number> }
  | { type: 'error'; message: string }

let ready = false

self.onmessage = async (e: MessageEvent<MsgIn>) => {
  const data = e.data
  try {
    if (data.type === 'init') {
      await loadTmAudioModel(data.baseUrl)
      ready = true
      ;(self as unknown as Worker).postMessage({ type: 'ready' } as MsgOut)
      return
    }
    if (data.type === 'predict') {
      if (!ready) await loadTmAudioModel()
      const f32 = new Float32Array(data.samples)
      const res = await predictFromFloat32Mono(f32, data.sampleRate)
      ;(self as unknown as Worker).postMessage({ type: 'pred', label: res.label, probs: res.probs } as MsgOut)
      return
    }
  } catch (err: any) {
    ;(self as unknown as Worker).postMessage({ type: 'error', message: String(err?.message || err) } as MsgOut)
  }
}


