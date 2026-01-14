import React from 'react'
import { getRuntimeEspHost, getWsUrlFromHost, setRuntimeEspHost } from '../../config/audio'
import { EspWsAudioClient, EspAudioStatus } from '../../infrastructure/audio/EspWsAudioClient'
import { createPredictionSmoother, loadTmAudioModel, predictFromFloat32Mono } from '../../ml/tm-audio/model'
import { getEspLcdClient, CryStatus } from '../../infrastructure/esp/EspLcdClient'

export type CryState = {
  isCrying: boolean
  confidence: number
  label: string
  probs: Record<string, number>
  micStatus: 'off' | 'on' | 'connecting' | 'error'
  lastUpdated: number
  espHost: string
}

const initialState: CryState = {
  isCrying: false,
  confidence: 0,
  label: 'unknown',
  probs: {},
  micStatus: 'off',
  lastUpdated: 0,
  espHost: getRuntimeEspHost(),
}

export function useCryDetection() {
  const [state, setState] = React.useState<CryState>(initialState)
  const clientRef = React.useRef<EspWsAudioClient | null>(null)
  const smootherRef = React.useRef(returnSmoother())
  const lastAudioTsRef = React.useRef(0)
  const workerRef = React.useRef<Worker | null>(null)
  const workerReadyRef = React.useRef(false)
  const chunkQueueRef = React.useRef<Float32Array[]>([])
  const totalSamplesRef = React.useRef(0)
  const srcSampleRateRef = React.useRef(16000)
  const windowSecRef = React.useRef(1.0)
  const lastInferTsRef = React.useRef(0)
  const hopMsRef = React.useRef(250)
  const espLcdClientRef = React.useRef(getEspLcdClient())
  const lastSentCryStatusRef = React.useRef<CryStatus | null>(null)

  function returnSmoother() {
    return createPredictionSmoother(800, 0.6)
  }

  const connect = React.useCallback(async (host?: string) => {
    const h = (host && host.trim()) || state.espHost || getRuntimeEspHost()
    const url = getWsUrlFromHost(h)

    // reset buffers when reconnecting
    chunkQueueRef.current = []
    totalSamplesRef.current = 0
    smootherRef.current = returnSmoother()
    lastInferTsRef.current = 0
    lastAudioTsRef.current = performance.now()

    if (!clientRef.current) {
      clientRef.current = new EspWsAudioClient({
        onStatus: (s: EspAudioStatus) => {
          setState(prev => ({
            ...prev,
            micStatus: mapMicStatus(s, lastAudioTsRef.current),
          }))
        },
        onAudioChunk: async (chunk, sr) => {
          lastAudioTsRef.current = performance.now()
          setState(prev => ({ ...prev, micStatus: 'on' }))
          // Buffering
          srcSampleRateRef.current = sr || 16000
          chunkQueueRef.current.push(chunk)
          totalSamplesRef.current += chunk.length
          if (import.meta.env.DEV) {
            console.log('[CryDetection] chunk', { length: chunk.length, totalSamples: totalSamplesRef.current, sampleRate: srcSampleRateRef.current })
          }

          // Ensure we know desired window length from model metadata
          try {
            const mdl = await loadTmAudioModel()
            if (mdl?.windowSec) windowSecRef.current = mdl.windowSec
          } catch (err) {
            console.warn('[CryDetection] metadata load failed', err)
          }

          const needed = Math.max(1, Math.round(windowSecRef.current * srcSampleRateRef.current))
          const now = performance.now()
          const hopMs = Math.max(100, hopMsRef.current)
          if (totalSamplesRef.current >= needed && now - lastInferTsRef.current >= hopMs) {
            // Assemble last `needed` samples from queue tail
            const buf = new Float32Array(needed)
            let remaining = needed
            let writePos = needed
            for (let i = chunkQueueRef.current.length - 1; i >= 0 && remaining > 0; i--) {
              const c = chunkQueueRef.current[i]
              const take = Math.min(remaining, c.length)
              writePos -= take
              buf.set(c.subarray(c.length - take), writePos)
              remaining -= take
            }
            lastInferTsRef.current = now
            try {
              const pred = await infer(buf, srcSampleRateRef.current)
              const { cryProb, notCryProb, displayLabel } = mapProbs(pred.probs)
              const ema = smootherRef.current.push(cryProb)
              const isCrying = ema >= 0.6
              const displayConfidence = isCrying ? ema : 1 - ema
              if (import.meta.env.DEV) {
                console.log('[CryDetection] pred', { label: displayLabel, cryProb, notCryProb, ema, probs: pred.probs })
              }

              // Determine cry status for ESP LCD (format tanpa spasi untuk kemudahan parsing di ESP)
              const cryStatus: CryStatus = isCrying ? 'Menangis' : 'TidakMenangis'

              // Send to ESP LCD if status changed
              if (lastSentCryStatusRef.current !== cryStatus) {
                lastSentCryStatusRef.current = cryStatus
                espLcdClientRef.current.sendCryStatus(cryStatus).catch(err => {
                  console.warn('[CryDetection] Failed to send to ESP LCD', err)
                })
              }

              setState(prev => ({
                ...prev,
                isCrying,
                confidence: Math.round(displayConfidence * 100),
                label: displayLabel,
                probs: pred.probs,
                lastUpdated: Date.now(),
              }))
            } catch (err) {
              console.error('[CryDetection] inference failed', err)
            }

            // Trim queue to keep at most 2x window
            const maxKeep = needed * 2
            let kept = totalSamplesRef.current
            while (kept > maxKeep && chunkQueueRef.current.length) {
              const first = chunkQueueRef.current[0]
              chunkQueueRef.current.shift()
              kept -= first.length
            }
            totalSamplesRef.current = kept
          }
        },
      })
    }

    clientRef.current.connect(url)
    setState(prev => ({ ...prev, espHost: h }))
  }, [state.espHost])

  const disconnect = React.useCallback(() => {
    clientRef.current?.disconnect()
    if (workerRef.current) {
      try { workerRef.current.terminate() } catch {}
      workerRef.current = null
      workerReadyRef.current = false
    }
  }, [])

  const setEspHost = React.useCallback((host: string) => {
    setRuntimeEspHost(host)
    setState(prev => ({ ...prev, espHost: host }))
  }, [])

  // auto-connect on mount
  React.useEffect(() => {
    // init worker
    try {
      const w = new Worker(new URL('../../workers/cry-worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = w
      w.onmessage = (ev: MessageEvent<any>) => {
        if (ev.data?.type === 'ready') workerReadyRef.current = true
      }
      w.postMessage({ type: 'init' })
    } catch {
      // fallback to main-thread inference
      workerRef.current = null
      workerReadyRef.current = false
    }
    connect().catch(() => {})
    return () => disconnect()
  }, [connect, disconnect])

  // downgrade status to connecting/off if no audio throughput in >2s
  React.useEffect(() => {
    const t = window.setInterval(() => {
      const since = performance.now() - lastAudioTsRef.current
      if (since > 2000) {
        setState(prev => ({ ...prev, micStatus: prev.micStatus === 'error' ? 'error' : 'connecting' }))
      }
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return {
    state,
    connect,
    disconnect,
    setEspHost,
  }
}

async function infer(chunk: Float32Array, sr: number): Promise<{ label: string; probs: Record<string, number> }> {
  // Try worker first
  // Note: this function will be shadowed in closure if moved; keeping here as a free function for clarity.
  // The worker is managed via refs above; we access via a singleton on window for simplicity.
  const anyWindow = window as any
  if (!anyWindow.__cryWorker) {
    try {
      const w = new Worker(new URL('../../workers/cry-worker.ts', import.meta.url), { type: 'module' })
      anyWindow.__cryWorker = { w, ready: false, pending: [] as { resolve: Function; reject: Function }[] }
      w.onmessage = (ev: MessageEvent<any>) => {
        if (ev.data?.type === 'ready') { anyWindow.__cryWorker.ready = true; return }
        if (ev.data?.type === 'pred') {
          const pending = anyWindow.__cryWorker.pending.shift()
          pending && pending.resolve({ label: ev.data.label, probs: ev.data.probs })
        }
        if (ev.data?.type === 'error') {
          console.error('[CryDetection worker] error', ev.data?.message)
          const pending = anyWindow.__cryWorker.pending.shift()
          pending && pending.reject(new Error(ev.data?.message || 'worker error'))
        }
      }
      w.postMessage({ type: 'init' })
    } catch {
      anyWindow.__cryWorker = null
    }
  }
  const cw = anyWindow.__cryWorker
  if (cw && cw.w) {
    const ab = chunk.buffer.slice(0)
    return await new Promise((resolve, reject) => {
      cw.pending.push({ resolve, reject })
      try {
        cw.w.postMessage({ type: 'predict', samples: ab, sampleRate: sr }, [ab])
      } catch (err) {
        cw.pending.pop()
        reject(err)
      }
    })
  }
  // fallback main-thread
  await loadTmAudioModel()
  return await predictFromFloat32Mono(chunk, sr)
}

function mapMicStatus(s: EspAudioStatus, lastAudioTs: number): CryState['micStatus'] {
  if (s === 'connected') {
    const since = performance.now() - lastAudioTs
    return since < 1500 ? 'on' : 'connecting'
  }
  if (s === 'connecting') return 'connecting'
  if (s === 'error') return 'error'
  return 'off'
}

function mapProbs(probs: Record<string, number>) {
  const keys = Object.keys(probs)
  const lower = (s: string) => s.toLowerCase()
  const clamp = (v: number) => Math.max(0, Math.min(1, v))

  const cryKey = keys.find(k => /cry|menangis/.test(lower(k))) || keys[0] || 'cry'
  const notCryKey = keys.find(k => /background|noise|diam|silent|tidak/.test(lower(k))) || keys.find(k => k !== cryKey) || 'background'

  const cryProb = clamp(probs[cryKey] ?? 0)
  const notCryProb = keys.length > 1 ? clamp(probs[notCryKey] ?? (1 - cryProb)) : clamp(1 - cryProb)

  const displayLabel = cryProb >= notCryProb ? 'Menangis' : 'Tidak Menangis'
  return { cryKey, cryProb, notCryProb, displayLabel }
}


