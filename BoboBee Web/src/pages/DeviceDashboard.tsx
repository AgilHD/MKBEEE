import { ArrowLeft } from 'lucide-react'
import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DevicePicker } from '../components/common/DevicePicker'
import { CryIndicator } from '../components/monitoring/CryIndicator'
import { LiveView } from '../components/monitoring/LiveView'
import { PostureCard } from '../components/monitoring/PostureCard'
import { SensorBadges } from '../components/monitoring/SensorBadges'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { MockDataGenerator } from '../infrastructure/repositories/MockDataGenerator'
import type { PostureStatus } from '../shared/types'
import { cn, formatTimestamp } from '../shared/utils'
import { useDeviceStore } from '../state/stores/useDeviceStore'

export function DeviceDashboard() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const { devices, selectedDeviceId, setSelectedDevice } = useDeviceStore()

  // ---- Live data state ----
  const [liveData, setLiveData] = React.useState({
    posture: { status: 'Unknown' as PostureStatus, confidence: 0, timestamp: new Date() },
    sensors: { tempC: 22, rh: 50, timestamp: new Date(), isSafe: true },
    cry: { level: 0 as 0 | 1 | 2 | 3, vadActive: false, timestamp: new Date() },
    snapshot: '/esp/stream',
  })

  const [alerts] = React.useState(MockDataGenerator.generateAlerts(deviceId || ''))
  const [config] = React.useState(MockDataGenerator.generateQuickConfig())

  const device = devices.find(d => d.id === deviceId)

  React.useEffect(() => {
    if (deviceId && deviceId !== selectedDeviceId) setSelectedDevice(deviceId)
  }, [deviceId, selectedDeviceId, setSelectedDevice])

  // ---- NORMALIZER: mapping label TM -> PostureStatus ----
  const normalizePosture = (label: string): PostureStatus => {
    const s = (label || '').toLowerCase().trim()
    // dukung Indonesia & Inggris
    if (s.includes('supine') || s.includes('terlentang')) return 'Supine'
    if (s.includes('prone') || s.includes('tengkurap')) return 'Prone'
    return 'Unknown'
  }

  // (Opsional) smoothing sederhana supaya lebih stabil
  const emaRef = React.useRef<number>(0)
  const alpha = 0.35 // 0..1 (besar = lebih responsif, kecil = lebih halus)

  // ---- Handler dari LiveView: terima predictions & update PostureCard ----
  const handlePoseDetected = (predictions: any[]) => {
    if (!predictions || predictions.length === 0) return
    // ambil prediksi top
    const top = [...predictions].sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))[0]
    const status = normalizePosture(top?.className)
    const prob = Math.max(0, Math.min(1, Number(top?.probability ?? 0)))
    // smooth confidence biar nggak “loncat”
    emaRef.current = emaRef.current === 0 ? prob : (alpha * prob + (1 - alpha) * emaRef.current)
    const confidence = Math.round(emaRef.current * 100)

    setLiveData(prev => ({
      ...prev,
      posture: {
        status,
        confidence,
        timestamp: new Date(),
      },
    }))
  }

  if (!device) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Device Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The device you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate('/devices')}>Back to Devices</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/devices')}
              className="hover:bg-amber-100 hover:text-amber-700 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                {device.name}
                <Badge
                  className={cn(
                    'text-sm font-medium px-3 py-1 rounded-full',
                    device.status === 'ONLINE' && 'bg-green-100 text-green-700 border border-green-200',
                    device.status === 'OFFLINE' && 'bg-gray-100 text-gray-700 border border-gray-200',
                    device.status === 'PAIRING' && 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  )}
                >
                  {device.status}
                </Badge>
              </h1>
              <div className="text-sm text-amber-700/70">
                {device.id} • v{device.firmwareVersion} • Last seen {formatTimestamp(device.lastSeen)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DevicePicker devices={devices} />
            {/* <Button
              variant="outline"
              size="icon"
              className="border-amber-200 hover:bg-amber-50 hover:border-amber-300 transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button> */}
          </div>
        </div>

        {/* Grid utama */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live View */}
          <div className="lg:col-span-2">
            <LiveView
              src={liveData.snapshot}
              enablePoseDetection
              modelBaseUrl="/tm-model/"
              onPoseDetected={handlePoseDetected}
              showPredictionPanel={false} // pakai PostureCard saja
            />
          </div>

          {/* Kolom kanan: urutan Posture -> Cry -> Environment */}
          <div className="space-y-4">
            <PostureCard
              posture={liveData.posture.status}
              confidence={liveData.posture.confidence}
            />
            <CryIndicator
              level={liveData.cry.level}
              vadActive={liveData.cry.vadActive}
            />
            <SensorBadges
              reading={liveData.sensors}
              thresholds={{ tempC: config.tempThreshold, rh: config.rhThreshold }}
            />
          </div>
        </div>

        {/* Tabs detail */}
        {/* <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList className="bg-amber-100/60 border border-amber-200">
            <TabsTrigger value="alerts">Alerts & Actions</TabsTrigger>
            <TabsTrigger value="audio">Audio Control</TabsTrigger>
            <TabsTrigger value="history">24h History</TabsTrigger>
            <TabsTrigger value="config">Quick Config</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-0">
            <AlertLog
              items={alerts}
              onAck={(id) => console.log('Ack', id)}
              onSnooze={(id, m) => console.log('Snooze', id, m)}
            />
          </TabsContent>

          <TabsContent value="audio" className="space-y-4">
            <AudioControlPanel deviceId={device.id} />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <HistoryChart deviceId={device.id} />
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <QuickConfigPanel deviceId={device.id} />
          </TabsContent>
        </Tabs> */}
      </div>
    </div>
  )
}
