// shared/postureMapper.ts
import type { PosePrediction } from '../components/monitoring/LiveView'
import type { PostureStatus } from './types'

// label di Teachable Machine: "Terlentang", "Tengkurap", "Unknown"
const SUPINE_LABELS = ['terlentang']
const PRONE_LABELS = ['tengkurap']
const UNKNOWN_LABELS = ['unknown']

function normalizeLabel(raw: string): 'Supine' | 'Prone' | 'Unknown' {
  const key = raw.toLowerCase().trim()
  if (SUPINE_LABELS.includes(key)) return 'Supine'
  if (PRONE_LABELS.includes(key)) return 'Prone'
  if (UNKNOWN_LABELS.includes(key)) return 'Unknown'
  return 'Unknown'
}

export interface PostureMappingResult {
  posture: PostureStatus
  /** 0..1 untuk UI */
  confidence: number
}

export function mapPredictionsToPosture(preds: PosePrediction[]): PostureMappingResult {
  if (!preds || preds.length === 0) {
    return { posture: 'Unknown', confidence: 0 }
  }

  // ambil prob maksimum per kelas
  let supineProb = 0
  let proneProb = 0
  let unknownProb = 0

  for (const p of preds) {
    const posture = normalizeLabel(p.className)
    const prob = Number(p.probability ?? 0)

    if (posture === 'Supine') supineProb = Math.max(supineProb, prob)
    else if (posture === 'Prone') proneProb = Math.max(proneProb, prob)
    else if (posture === 'Unknown') unknownProb = Math.max(unknownProb, prob)
  }

  // bikin list lalu ambil yang paling tinggi
  const candidates: Array<{ posture: PostureStatus; prob: number }> = [
    { posture: 'Supine', prob: supineProb },
    { posture: 'Prone', prob: proneProb },
    { posture: 'Unknown', prob: unknownProb },
  ]

  candidates.sort((a, b) => b.prob - a.prob)
  const top = candidates[0]
  const second = candidates[1]

  const MIN_TOP = 0.6 // kalau top prob < 0.6 → kita anggap belum yakin

  // kalau yang paling tinggi unknown, atau confidence rendah → Unknown
  if (top.posture === 'Unknown' || top.prob < MIN_TOP) {
    return { posture: 'Unknown', confidence: 0 }
  }

  // posture final = kelas dengan prob paling tinggi
  const posture = top.posture

  // confidence UI pakai prob top langsung (0..1)
  const confidence = Math.max(0, Math.min(1, top.prob))

  return { posture, confidence }
}
