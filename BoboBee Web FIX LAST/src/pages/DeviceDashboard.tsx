import { ArrowLeft } from 'lucide-react'
import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DevicePicker } from '../components/common/DevicePicker'
import { CryIndicator } from '../components/monitoring/CryIndicator'
import { LiveView, PosePrediction } from '../components/monitoring/LiveView'
import { PostureCard } from '../components/monitoring/PostureCard'
import { SensorBadges } from '../components/monitoring/SensorBadges'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { MockDataGenerator } from '../infrastructure/repositories/MockDataGenerator'
import { useEspLcdSensors } from '../services/sensors/EspLcdSensorService'
import { mapPredictionsToPosture } from '../shared/postureMapper'
import type { PostureStatus } from '../shared/types'
import { cn, formatTimestamp } from '../shared/utils'
import { useDeviceStore } from '../state/stores/useDeviceStore'

type LiveDataState = {
  posture: {
    status: PostureStatus
    confidence: number // 0..1
    timestamp: Date
  }
  snapshot: string
}

export function DeviceDashboard() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const { devices, selectedDeviceId, setSelectedDevice } = useDeviceStore()

  const [liveData, setLiveData] = React.useState<LiveDataState>({
    posture: { status: 'Unknown', confidence: 0, timestamp: new Date() },
    snapshot: '/esp/stream',
  })

  const [alerts] = React.useState(MockDataGenerator.generateAlerts(deviceId || ''))
  const [config] = React.useState(MockDataGenerator.generateQuickConfig())

  const sensorData = useEspLcdSensors({
    pollIntervalMs: 2000,
    enabled: true,
    thresholds: { tempC: config.tempThreshold, rh: config.rhThreshold },
  })

  const sensorReading = sensorData.reading || {
    tempC: 22,
    rh: 50,
    timestamp: new Date(),
    isSafe: true,
  }

  const device = devices.find((d) => d.id === deviceId)

  React.useEffect(() => {
    if (deviceId && deviceId !== selectedDeviceId) setSelectedDevice(deviceId)
  }, [deviceId, selectedDeviceId, setSelectedDevice])

  // EMA kecil untuk smooth confidence (tidak mengubah kelasnya)
  const emaRef = React.useRef<number | null>(null)
  const alpha = 0.5

  const handlePoseDetected = (preds: PosePrediction[]) => {
    if (!preds || preds.length === 0) return

    const { posture, confidence } = mapPredictionsToPosture(preds) // confidence 0..1

    // smoothing confidence (KLASNYA tidak diubah)
    if (emaRef.current == null) {
      emaRef.current = confidence
    } else {
      emaRef.current = alpha * confidence + (1 - alpha) * emaRef.current
    }

    setLiveData((prev) => ({
      ...prev,
      posture: {
        status: posture,
        confidence: emaRef.current ?? confidence,
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
            The device you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
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
                    device.status === 'PAIRING' && 'bg-yellow-100 text-yellow-700 border border-yellow-200',
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
          </div>
        </div>

        {/* Grid utama */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live View */}
          <div className="lg:col-span-2">
            <LiveView
              src={liveData.snapshot}
              enablePoseDetection
              modelBaseUrl="/tm-model-v2/"
              onPoseDetected={handlePoseDetected}
              showPredictionPanel={false}
            />
          </div>

          <div className="space-y-4">
            <PostureCard
              posture={liveData.posture.status}
              confidence={liveData.posture.confidence}
            />
            <CryIndicator />
            <SensorBadges
              reading={sensorReading}
              thresholds={{ tempC: config.tempThreshold, rh: config.rhThreshold }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
