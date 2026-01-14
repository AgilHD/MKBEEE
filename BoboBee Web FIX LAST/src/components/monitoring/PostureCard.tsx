import { AlertTriangle, Baby, HelpCircle, ShieldCheck } from 'lucide-react'
import { PostureStatus } from '../../shared/types'
import { cn } from '../../shared/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface PostureCardProps {
  posture: PostureStatus
  /** 0..1 */
  confidence: number
  className?: string
}

export function PostureCard({ posture, confidence, className }: PostureCardProps) {
  const isProne = posture === 'Prone'
  const isSupine = posture === 'Supine'
  const isUnknown = posture === 'Unknown'

  const pct = Math.max(0, Math.min(100, Math.round((confidence || 0) * 100)))

  return (
    <Card
      className={cn(
        'transition-all duration-300 bg-white/90 backdrop-blur-sm shadow-xl border-0',
        isProne && 'ring-2 ring-red-400 shadow-red-200/50',
        className,
      )}
      aria-live="polite"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            <Baby className={cn('h-5 w-5', isProne ? 'text-red-500' : 'text-amber-500')} />
            Sleep Position
          </CardTitle>
          {isProne && <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" aria-label="Prone warning" />}
          {isSupine && <ShieldCheck className="h-5 w-5 text-green-600" aria-label="Supine safe" />}
          {isUnknown && <HelpCircle className="h-5 w-5 text-amber-600/80" aria-label="Unknown posture" />}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {!isUnknown && (
          <div className="text-sm text-amber-700/80 font-medium">
            {pct}% confident
          </div>
        )}

        {!isUnknown && (
          <div className="w-full bg-gray-200/70 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-500',
                isSupine ? 'bg-green-500' : 'bg-red-500',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {isSupine && (
          <div className="p-3 bg-green-50 rounded-xl border border-green-200 shadow-sm">
            <div className="text-sm text-green-800">
              <strong>Aman:</strong> Bayi dalam posisi <em>terlentang</em>. Ini adalah posisi tidur yang disarankan.
              Pastikan area sekitar bersih dari bantal/selimut tebal.
            </div>
          </div>
        )}

        {isProne && (
          <div className="p-3 bg-red-50 rounded-xl border border-red-200 shadow-sm">
            <div className="text-sm text-red-700">
              <strong>Peringatan:</strong> Bayi <em>tengkurap</em>. Segera periksa dan kembalikan ke posisi terlentang.
            </div>
          </div>
        )}

        {isUnknown && (
          <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200 shadow-sm">
            <div className="text-sm text-yellow-800">
              Posisi belum jelas. Coba atur ulang sudut kamera, pencahayaan, atau jarak. Pastikan bayi terlihat penuh.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
