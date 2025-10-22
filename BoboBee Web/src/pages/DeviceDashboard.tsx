import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { Device } from '../shared/types';
import { MockDataGenerator } from '../infrastructure/repositories/MockDataGenerator';
import { useDeviceStore } from '../state/stores/useDeviceStore';
import { DEVICE_STATUS_COLORS, REFRESH_INTERVALS } from '../shared/constants';
import { formatTimestamp } from '../shared/utils';
import { DevicePicker } from '../components/common/DevicePicker';
import { LiveView } from '../components/monitoring/LiveView';
import { PostureCard } from '../components/monitoring/PostureCard';
import { CryIndicator } from '../components/monitoring/CryIndicator';
import { SensorBadges } from '../components/monitoring/SensorBadges';
import { AlertLog } from '../components/alerts/AlertLog';
import { AudioControlPanel } from '../components/audio/AudioControlPanel';
import { HistoryChart } from '../components/history/HistoryChart';
import { QuickConfigPanel } from '../components/config/QuickConfigPanel';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { cn } from '../shared/utils';

export function DeviceDashboard() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const { devices, selectedDeviceId, setSelectedDevice } = useDeviceStore();
  
  // Mock live data states
  const [liveData, setLiveData] = React.useState({
    posture: MockDataGenerator.generatePostureReading(),
    sensors: MockDataGenerator.generateSensorReading(),
    cry: { level: 0 as 0 | 1 | 2 | 3, vadActive: false, timestamp: new Date() },
    snapshot: 'https://images.pexels.com/photos/1166473/pexels-photo-1166473.jpeg?auto=compress&cs=tinysrgb&w=640&h=480&fit=crop',
  });
  
  const [alerts] = React.useState(MockDataGenerator.generateAlerts(deviceId || ''));
  const [config] = React.useState(MockDataGenerator.generateQuickConfig());

  const device = devices.find(d => d.id === deviceId);

  React.useEffect(() => {
    if (deviceId && deviceId !== selectedDeviceId) {
      setSelectedDevice(deviceId);
    }
  }, [deviceId, selectedDeviceId, setSelectedDevice]);

  // Simulate live data updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLiveData(prev => ({
        posture: MockDataGenerator.generatePostureReading(),
        sensors: MockDataGenerator.generateSensorReading(),
        cry: {
          level: Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3,
          vadActive: Math.random() > 0.7,
          timestamp: new Date(),
        },
        snapshot: prev.snapshot, // Keep same image
      }));
    }, REFRESH_INTERVALS.LIVE_DATA);

    return () => clearInterval(interval);
  }, []);

  const handleAckAlert = async (alertId: string) => {
    console.log('Acknowledging alert:', alertId);
    // In real implementation, call alert service
  };

  const handleSnoozeAlert = async (alertId: string, minutes: number) => {
    console.log('Snoozing alert:', alertId, 'for', minutes, 'minutes');
    // In real implementation, call alert service
  };

  if (!device) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Device Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The device you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate('/devices')}>
            Back to Devices
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/devices')}
            className="hover:bg-amber-100 hover:text-amber-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              {device.name}
              <Badge className={cn(
                'text-sm font-medium px-3 py-1 rounded-full',
                device.status === 'ONLINE' && 'bg-green-100 text-green-700 border border-green-200',
                device.status === 'OFFLINE' && 'bg-gray-100 text-gray-700 border border-gray-200',
                device.status === 'PAIRING' && 'bg-yellow-100 text-yellow-700 border border-yellow-200'
              )}>
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
          <Button 
            variant="outline" 
            size="icon"
            className="border-amber-200 hover:bg-amber-50 hover:border-amber-300 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="space-y-6">
        {/* Live Monitoring Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live View - spans 2 columns on large screens */}
          <div className="lg:col-span-2">
            <LiveView 
              src={liveData.snapshot}
              onFullscreen={() => console.log('Fullscreen mode')}
            />
          </div>
          
          {/* Status Cards */}
          <div className="space-y-4">
            <PostureCard
              posture={liveData.posture.status}
              confidence={liveData.posture.confidence}
            />
            <CryIndicator
              level={liveData.cry.level}
              vadActive={liveData.cry.vadActive}
            />
          </div>
        </div>

        {/* Environmental Monitoring */}
        <SensorBadges
          reading={liveData.sensors}
          thresholds={{
            tempC: config.tempThreshold,
            rh: config.rhThreshold,
          }}
        />

        {/* Detailed Tabs */}
        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alerts">Alerts & Actions</TabsTrigger>
            <TabsTrigger value="audio">Audio Control</TabsTrigger>
            <TabsTrigger value="history">24h History</TabsTrigger>
            <TabsTrigger value="config">Quick Config</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-0">
            <AlertLog
              items={alerts}
              onAck={handleAckAlert}
              onSnooze={handleSnoozeAlert}
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
        </Tabs>
      </div>
      </div>
    </div>
  );
}