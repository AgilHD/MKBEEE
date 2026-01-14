import { TM_AUDIO_BASE } from '../../config/audio'
import { linearResampleMono } from '../audio/resample'

type LoadedModel = {
  model: any
  tf: typeof import('@tensorflow/tfjs')
  labels: string[]
  expectedSampleRate: number
  frameLength: number
  frameStep: number
  numFrames: number
  specCols: number
  windowSec: number
}

let loaded: LoadedModel | null = null

export async function loadTmAudioModel(baseUrl: string = TM_AUDIO_BASE): Promise<LoadedModel> {
  if (loaded) return loaded
  const tf = await import('@tensorflow/tfjs')
  try { await tf.setBackend('webgl') } catch {}
  await tf.ready()

  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
  const globalLoc = (() => {
    if (typeof globalThis !== 'undefined' && (globalThis as any).location?.href) return (globalThis as any).location.href
    if (typeof window !== 'undefined' && window.location?.href) return window.location.href
    if (typeof self !== 'undefined' && (self as any).location?.href) return (self as any).location.href
    if (typeof import.meta !== 'undefined' && (import.meta as any).url) return (import.meta as any).url
    return 'http://localhost/'
  })()
  const resolveBase = /^https?:/i.test(base) ? base : new URL(base, globalLoc).toString()
  const modelUrl = new URL('model.json', resolveBase).toString()
  const metadataUrl = new URL('metadata.json', resolveBase).toString()

  const metadata = await fetch(metadataUrl).then((r) => r.json()).catch(() => ({}))
  const labels: string[] = Array.isArray(metadata.wordLabels)
    ? metadata.wordLabels
    : Array.isArray(metadata.labels)
      ? metadata.labels
      : ['Background Noise', 'Menangis']
  const expectedSampleRate = Number(metadata.sample_rate_hz || metadata.sampleRateHz || 44100)

  const model = await tf.loadLayersModel(modelUrl)
  const inputShape = model.inputs?.[0]?.shape || [null, 43, 232, 1]
  const numFrames = Number(inputShape[1] ?? 43)
  const specCols = Number(inputShape[2] ?? 232)
  const frameLength = 1024
  const frameStep = frameLength
  const windowSec = (frameLength + frameStep * (numFrames - 1)) / expectedSampleRate

  loaded = { model, tf, labels, expectedSampleRate, frameLength, frameStep, numFrames, specCols, windowSec }
  console.log('✅ TM Audio model loaded', { base: resolveBase, expectedSampleRate, labels, inputShape })
  return loaded
}

export async function predictFromFloat32Mono(samples: Float32Array, sampleRate: number): Promise<{ label: string; probs: Record<string, number> }> {
  const ctx = await loadTmAudioModel()
  const { model, tf, expectedSampleRate, frameLength, frameStep, numFrames, specCols } = ctx

  let waveform = samples
  let sr = sampleRate
  if (sr !== expectedSampleRate) {
    const res = linearResampleMono(samples, sr, expectedSampleRate)
    waveform = res.samples
    sr = res.sampleRate
  }

  const requiredSamples = frameLength + frameStep * (numFrames - 1)
  if (waveform.length < requiredSamples) {
    const padded = new Float32Array(requiredSamples)
    padded.set(waveform, requiredSamples - waveform.length)
    waveform = padded
  } else if (waveform.length > requiredSamples) {
    waveform = waveform.subarray(waveform.length - requiredSamples)
  }

  const features = tf.tidy(() => {
    const audio = tf.tensor1d(waveform)
    const stft = tf.signal.stft(audio, frameLength, frameStep, frameLength)
    const magnitude = tf.abs(stft)
    const truncated = magnitude.slice([0, 0], [numFrames, specCols])
    const logScaled = tf.log1p(truncated)
    const { mean, variance } = tf.moments(logScaled)
    const normalized = logScaled.sub(mean).div(variance.sqrt().add(1e-6))
    return normalized.reshape([1, numFrames, specCols, 1])
  })

  const logits = model.predict(features) as any
  const probsArr: number[] = Array.from(await logits.data())
  features.dispose()
  tf.dispose(logits)

  const probs: Record<string, number> = {}
  let topIdx = 0
  let topVal = -Infinity
  for (let i = 0; i < ctx.labels.length && i < probsArr.length; i++) {
    const p = Math.max(0, Math.min(1, probsArr[i]))
    probs[ctx.labels[i]] = p
    if (p > topVal) { topVal = p; topIdx = i }
  }
  const label = ctx.labels[topIdx] || 'unknown'
  return { label, probs }
}

export function createPredictionSmoother(windowMs = 800, alpha = 0.6) {
  let ema = 0
  const buf: { t: number; v: number }[] = []
  const maxAge = windowMs
  return {
    push(value: number, now = performance.now()) {
      ema = ema === 0 ? value : alpha * value + (1 - alpha) * ema
      buf.push({ t: now, v: value })
      while (buf.length && now - buf[0].t > maxAge) buf.shift()
      return ema
    },
    get ema() { return ema },
    get windowAvg() {
      if (!buf.length) return 0
      const s = buf.reduce((a, b) => a + b.v, 0)
      return s / buf.length
    }
  }
}


