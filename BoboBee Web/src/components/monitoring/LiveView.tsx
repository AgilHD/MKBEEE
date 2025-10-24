import { AlertCircle, Maximize, RefreshCw } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../shared/utils'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface LiveViewProps {
  /** URL stream (disarankan lewat proxy: "/esp/stream") */
  src: string
  onFullscreen?: () => void
  className?: string

  /** Aktifkan pose detection (default: false) */
  enablePoseDetection?: boolean
  /** Callback tiap emisi hasil prediksi (sudah di-throttle) */
  onPoseDetected?: (predictions: any[]) => void

  /** Base URL model offline (harus berisi model.json & metadata.json). Default: "/tm-model/" */
  modelBaseUrl?: string

  /** Tampilkan panel prediksi lokal (default: false). Saran: biarkan false agar tidak dobel dengan PostureCard */
  showPredictionPanel?: boolean

  /** Mirror horizontal input (default: true) agar konsisten dengan halaman /tm bawaan TM */
  mirror?: boolean

  /** Interval emisi hasil ke parent (ms). Default: 1000 ms (1 detik) */
  emitIntervalMs?: number

  /** Batas FPS deteksi (soft cap). Default: 20 */
  detectionFps?: number
}

interface PosePrediction {
  className: string
  probability: number
}

export function LiveView({
  src,
  onFullscreen,
  className,
  enablePoseDetection = false,
  onPoseDetected,
  modelBaseUrl = '/tm-model/',
  showPredictionPanel = false,
  mirror = true,
  emitIntervalMs = 1000,
  detectionFps = 20,
}: LiveViewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [predictions, setPredictions] = useState<PosePrediction[]>([])
  const [statusText, setStatusText] = useState<string>('Idle')

  // Layer video (IMG) + overlay (canvas untuk skeleton)
  const imgRef = useRef<HTMLImageElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  // Kanvas proses (offscreen) untuk feeding ke model
  const procCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // RAF & timing
  const rafRef = useRef<number | null>(null)
  const lastDetectTsRef = useRef<number>(0)

  // Model & TF
  const modelRef = useRef<any>(null)
  const tfRef = useRef<any>(null)

  // Throttle/Delay emisi
  const emitTimerRef = useRef<number | null>(null)
  const latestPredRef = useRef<PosePrediction[] | null>(null)

  /** Sinkronkan ukuran overlay = natural size image (agar koordinat pose akurat) */
  const syncOverlaySize = useCallback(() => {
    const img = imgRef.current
    const overlay = overlayRef.current
    if (!img || !overlay) return
    const w = img.naturalWidth || overlay.width
    const h = img.naturalHeight || overlay.height
    overlay.width = w
    overlay.height = h
  }, [])

  /** Smoothing ringan (EMA) untuk membuat probability stabil */
  const emaMapRef = useRef<Map<string, number>>(new Map())
  const emaAlpha = 0.35 // 0..1 (besar = responsif, kecil = halus)

  const smoothPredictions = useCallback((raw: PosePrediction[]): PosePrediction[] => {
    if (!raw || !raw.length) return raw
    const map = emaMapRef.current
    const out = raw.map((p) => {
      const key = p.className || 'Unknown'
      const prev = map.get(key) ?? p.probability
      const next = emaAlpha * p.probability + (1 - emaAlpha) * prev
      map.set(key, next)
      return { className: key, probability: next }
    })
    // normalisasi & sort desc
    out.sort((a, b) => b.probability - a.probability)
    return out
  }, [])

  /** Event sukses load stream */
  const handleImageLoad = useCallback(() => {
    setIsLoading(false)
    setHasError(false)
    setLastUpdate(new Date())
    syncOverlaySize()
  }, [syncOverlaySize])

  /** Event gagal stream (auto retry) */
  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false)
    setHasError(true)
    console.error('❌ ESP32 stream connection failed:', e)
    setTimeout(() => {
      if (imgRef.current) imgRef.current.src = src.includes('/esp/stream') ? src : `${src}?t=${Date.now()}`
    }, 2000)
  }, [src])

  /** Load TFJS & TM Pose (offline) */
  const loadModel = useCallback(async () => {
    if (!enablePoseDetection || modelRef.current) return
    try {
      setStatusText('Loading TFJS…')
      const tf = await import('@tensorflow/tfjs')
      tfRef.current = tf
      try { await tf.setBackend('webgl') } catch {}
      await tf.ready()

      setStatusText('Loading TM Pose…')
      const tmPose = await import('@teachablemachine/pose')
      const base = modelBaseUrl.endsWith('/') ? modelBaseUrl : modelBaseUrl + '/'
      const modelURL = base + 'model.json'
      const metadataURL = base + 'metadata.json'
      modelRef.current = await tmPose.load(modelURL, metadataURL)

      if (!procCanvasRef.current) procCanvasRef.current = document.createElement('canvas')
      setStatusText('Model ready')
      console.log('✅ TM Pose model loaded from', modelURL)
    } catch (err) {
      console.error('❌ Failed to load model:', err)
      setStatusText('Model load failed')
    }
  }, [enablePoseDetection, modelBaseUrl])

  /** Deteksi pose (rate-limited) */
  const detectPose = useCallback(async () => {
    const model = modelRef.current
    const img = imgRef.current
    const overlay = overlayRef.current
    let procCanvas = procCanvasRef.current
    if (!model || !img || !overlay) return
    if (!img.naturalWidth || !img.naturalHeight) return

    // rate limit detection
    const now = performance.now()
    const minDelta = 1000 / Math.max(1, detectionFps) // ms
    if (now - lastDetectTsRef.current < minDelta) return
    lastDetectTsRef.current = now

    if (!procCanvas) {
      procCanvas = document.createElement('canvas')
      procCanvasRef.current = procCanvas
    }
    procCanvas.width = img.naturalWidth
    procCanvas.height = img.naturalHeight
    const pctx = procCanvas.getContext('2d')
    const octx = overlay.getContext('2d')
    if (!pctx || !octx) return

    // Mirror (agar sama seperti /tm bawaan TM)
    pctx.save()
    if (mirror) {
      pctx.translate(procCanvas.width, 0)
      pctx.scale(-1, 1)
    }
    pctx.drawImage(img, 0, 0, procCanvas.width, procCanvas.height)
    pctx.restore()

    const { pose, posenetOutput } = await model.estimatePose(procCanvas as any)
    if (posenetOutput) {
      const pred = await model.predict(posenetOutput)
      const mapped: PosePrediction[] = pred.map((p: any) => ({
        className: String(p.className ?? 'Unknown'),
        probability: Number(p.probability ?? 0),
      }))
      const smoothed = smoothPredictions(mapped)
      setPredictions(smoothed)
      latestPredRef.current = smoothed
    }

    // Gambar overlay (ikut mirror supaya overlay pas)
    octx.clearRect(0, 0, overlay.width, overlay.height)
    if (pose?.keypoints?.length) {
      const tmPose = await import('@teachablemachine/pose')
      octx.save()
      if (mirror) {
        octx.translate(overlay.width, 0)
        octx.scale(-1, 1)
      }
      tmPose.drawKeypoints(pose.keypoints, 0.5, octx)
      tmPose.drawSkeleton(pose.keypoints, 0.5, octx)
      octx.restore()
    }
  }, [mirror, detectionFps, smoothPredictions])

  /** RAF loop */
  const animate = useCallback(() => {
    if (modelRef.current) {
      detectPose().catch(() => {})
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [detectPose])

  /** Refresh img (untuk sumber non-stream) */
  const refreshImage = useCallback(() => {
    if (!imgRef.current) return
    setIsLoading(true)
    setHasError(false)
    imgRef.current.src = src.includes('/esp/stream') ? src : `${src}?t=${Date.now()}`
  }, [src])

  // Auto-refresh hanya bila bukan MJPEG stream
  useEffect(() => {
    if (!src.includes('/esp/stream')) {
      const t = window.setInterval(refreshImage, 2000)
      return () => clearInterval(t)
    }
  }, [refreshImage, src])

  // Load model bila diaktifkan
  useEffect(() => {
    if (enablePoseDetection) loadModel()
  }, [enablePoseDetection, loadModel])

  // Start RAF
  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [animate])

  // Resize observer agar overlay tetap pas saat layout berubah
  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const ro = new ResizeObserver(() => syncOverlaySize())
    ro.observe(img)
    return () => ro.disconnect()
  }, [syncOverlaySize])

  // Throttle/delay emisi ke parent setiap emitIntervalMs
  useEffect(() => {
    if (!enablePoseDetection || !onPoseDetected) return
    if (emitTimerRef.current) window.clearInterval(emitTimerRef.current)
    emitTimerRef.current = window.setInterval(() => {
      if (latestPredRef.current) {
        onPoseDetected(latestPredRef.current)
      }
    }, Math.max(200, emitIntervalMs)) as unknown as number
    return () => {
      if (emitTimerRef.current) window.clearInterval(emitTimerRef.current)
      emitTimerRef.current = null
    }
  }, [enablePoseDetection, onPoseDetected, emitIntervalMs])

  return (
    <Card className={cn('overflow-hidden bg-white/90 backdrop-blur-sm shadow-xl border-0', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            Live View
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <div className="text-sm text-green-700 font-medium">Live Stream</div>
              <div className="text-sm text-amber-700/70">{lastUpdate.toLocaleTimeString()}</div>
            </div>
            {enablePoseDetection && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 border border-green-200 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-700">
                  {statusText === 'Model ready' ? 'AI Active' : statusText}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshImage}
              disabled={isLoading}
              className="hover:bg-amber-50 hover:text-amber-600"
              aria-label="Refresh stream"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            {onFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onFullscreen}
                className="hover:bg-amber-50 hover:text-amber-600"
                aria-label="Fullscreen"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative aspect-video bg-gradient-to-br from-amber-50 to-yellow-100">
          {hasError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-600/70">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">Camera unavailable</p>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshImage}
                className="mt-2 border-amber-200 hover:bg-amber-50"
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              <img
                ref={imgRef}
                src={src}
                alt="Live camera feed"
                onLoad={handleImageLoad}
                onError={handleImageError}
                className={cn('w-full h-full object-cover', mirror && 'scale-x-[-1]')}
                crossOrigin="anonymous"       // penting agar canvas tidak tainted
              />
              {enablePoseDetection && (
                <canvas
                  ref={overlayRef}
                  className={cn('absolute inset-0 w-full h-full object-cover pointer-events-none', mirror && 'scale-x-[-1]')}
                  style={{ zIndex: 10 }}
                />
              )}
              {isLoading && (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-yellow-100 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>

      {/* Panel prediksi lokal — default disembunyikan agar tidak dobel dengan PostureCard */}
      {enablePoseDetection && showPredictionPanel && predictions.length > 0 && (
        <div className="p-4 bg-amber-50 border-t border-amber-200">
          <div className="space-y-2">
            {predictions.slice(0, 2).map((p, i) => {
              const prob = Math.max(0, Math.min(1, p.probability))
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-all duration-200',
                    i === 0 ? 'bg-amber-100 border-amber-300 shadow-sm' : 'bg-white border-amber-200'
                  )}
                >
                  <span className="font-medium text-gray-800 capitalize">
                    {p.className}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300 bg-amber-500"
                        style={{ width: `${prob * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-600 w-12 text-right">
                      {Math.round(prob * 100)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
