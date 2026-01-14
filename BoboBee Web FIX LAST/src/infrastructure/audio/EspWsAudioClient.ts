export type EspAudioStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

type Handlers = {
  onStatus?: (s: EspAudioStatus) => void
  onAudioChunk?: (chunk: Float32Array, sampleRate: number) => void
}

type Options = {
  sampleRate?: number
  minBackoffMs?: number
  maxBackoffMs?: number
  minBinaryBytes?: number  // minimal bytes agar dianggap audio
}

export class EspWsAudioClient {
  private ws: WebSocket | null = null
  private url: string | null = null
  private reconnectTimer: number | null = null
  private attempt = 0

  private readonly sampleRate: number
  private readonly minBackoff: number
  private readonly maxBackoff: number
  private readonly minBinaryBytes: number

  private bytesSinceTick = 0
  private lastThroughputTs = 0
  private firstBinarySeen = false

  constructor(private handlers: Handlers = {}, opts: Options = {}) {
    this.sampleRate = opts.sampleRate ?? 16000
    this.minBackoff = opts.minBackoffMs ?? 1000
    this.maxBackoff = opts.maxBackoffMs ?? 5000
    this.minBinaryBytes = opts.minBinaryBytes ?? 512
  }

  connect(url: string) {
    this.url = url
    this.clearReconnect()
    this.open()
  }

  private open() {
    if (!this.url) return
    try {
      this.emitStatus('connecting')
      const ws = new WebSocket(this.url)
      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        this.attempt = 0
        this.emitStatus('connected')
        this.bytesSinceTick = 0
        this.lastThroughputTs = performance.now()
        this.firstBinarySeen = false
        console.log('🔊 ESP WS connected:', this.url)

        try {
          ws.send(JSON.stringify({
            action: 'subscribe',
            stream: 'audio',
            format: 'pcm16',
            sampleRate: this.sampleRate
          }))
        } catch {}
      }

      ws.onmessage = async (ev: MessageEvent) => {
        // A) TEXT → hanya jika format jelas audio (audio:<b64> / {"audio":...})
        if (typeof ev.data === 'string') {
          const abLike = decodeTextFrameStrict(ev.data) // ArrayBufferLike | null
          if (!abLike) return // heartbeat / ack → abaikan
          this.handleBinary(abLike)
          return
        }

        // B) BINARY
        if (ev.data instanceof ArrayBuffer) {
          this.handleBinary(ev.data)
          return
        }
        if (ev.data instanceof Blob) {
          try {
            const ab = await ev.data.arrayBuffer()
            this.handleBinary(ab)
          } catch (e) {
            console.warn('[ESP WS] Blob->ArrayBuffer failed', e)
          }
          return
        }
      }

      ws.onerror = (e) => {
        console.warn('ESP WS error', e)
        this.emitStatus('error')
      }
      ws.onclose = () => {
        this.emitStatus('disconnected')
        this.scheduleReconnect()
      }

      this.ws = ws
    } catch (e) {
      console.error('ESP WS open failed', e)
      this.emitStatus('error')
      this.scheduleReconnect()
    }
  }

  private handleBinary(abLike: ArrayBufferLike) {
    const byteLength = (abLike as ArrayBuffer).byteLength ?? (abLike as any).byteLength
    if ((byteLength & 1) !== 0) return                // PCM16 harus genap
    if (byteLength < this.minBinaryBytes) return      // terlalu kecil → buang

    this.bytesSinceTick += byteLength

    if (!this.firstBinarySeen) {
      const dv = new DataView(abLike as ArrayBuffer)
      const s0 = dv.getInt16(0, true)
      const s1 = dv.getInt16(2, true)
      console.log(`[ESP WS] First packet bytes: ${byteLength} | samples[0..1]=${s0},${s1}`)
      this.firstBinarySeen = true
    }

    const i16 = new Int16Array(abLike)
    const out = new Float32Array(i16.length)
    const inv = 1 / 32768
    for (let i = 0; i < i16.length; i++) {
      let v = i16[i] * inv
      if (v > 1) v = 1
      else if (v < -1) v = -1
      out[i] = v
    }

    this.handlers.onAudioChunk?.(out, this.sampleRate)

    const now = performance.now()
    if (now - this.lastThroughputTs >= 1000) {
      const sec = (now - this.lastThroughputTs) / 1000
      const bps = sec > 0 ? this.bytesSinceTick / sec : 0
      console.log('WS audio throughput ~', Math.round(bps), 'B/s')
      this.bytesSinceTick = 0
      this.lastThroughputTs = now
    }
  }

  private scheduleReconnect() {
    if (!this.url) return
    this.clearReconnect()
    const delay = Math.min(this.maxBackoff, this.minBackoff * Math.pow(2, this.attempt++))
    this.reconnectTimer = window.setTimeout(() => this.open(), delay) as unknown as number
  }

  private clearReconnect() {
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  disconnect() {
    this.clearReconnect()
    try { this.ws?.close() } catch {}
    this.ws = null
    this.emitStatus('disconnected')
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private emitStatus(s: EspAudioStatus) {
    this.handlers.onStatus?.(s)
  }
}

/**
 * Decoder teks yang *ketat*:
 *  - "audio:<base64>"        → base64 decode
 *  - JSON {"audio":"<b64>"}  → base64 decode
 *  - JSON {"pcm16":[...]}    → Int16Array
 *  Selain itu (ex: "beat", ack): return null
 */
function decodeTextFrameStrict(text: string): ArrayBufferLike | null {
  const trimmed = text?.trim?.() ?? ''
  if (!trimmed) return null

  // 1) Prefix "audio:<base64>"
  if (trimmed.startsWith('audio:')) {
    const b64 = trimmed.slice(6).trim()
    const u8 = decodeBase64(b64)
    return u8?.buffer ?? null
  }

  // 2) JSON
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed)
      if (obj && typeof obj.audio === 'string') {
        const u8 = decodeBase64(obj.audio)
        return u8?.buffer ?? null
      }
      if (Array.isArray(obj?.pcm16)) {
        const arr = obj.pcm16 as number[]
        const i16 = new Int16Array(arr.length)
        for (let i = 0; i < arr.length; i++) i16[i] = (arr[i] | 0)
        return i16.buffer
      }
      return null
    } catch {
      return null
    }
  }
  return null
}

function decodeBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}
