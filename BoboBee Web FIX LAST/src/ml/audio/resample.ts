export interface ResampleResult {
  samples: Float32Array
  sampleRate: number
}

export function linearResampleMono(input: Float32Array, fromRate: number, toRate: number): ResampleResult {
  if (!input || input.length === 0 || fromRate === toRate) {
    return { samples: input || new Float32Array(0), sampleRate: fromRate }
  }
  const ratio = toRate / fromRate
  const outLen = Math.max(1, Math.round(input.length * ratio))
  const out = new Float32Array(outLen)
  const inv = 1 / ratio
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * inv
    const srcIdx = Math.floor(srcPos)
    const frac = srcPos - srcIdx
    const s0 = input[srcIdx] ?? input[input.length - 1]
    const s1 = input[srcIdx + 1] ?? input[input.length - 1]
    out[i] = s0 + (s1 - s0) * frac
  }
  return { samples: out, sampleRate: toRate }
}


