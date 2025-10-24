import { Clock, Home, Plus, Settings, Wifi, WifiOff } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PairDeviceDialog } from '../components/pairing/PairDeviceDialog';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { MockDataGenerator } from '../infrastructure/repositories/MockDataGenerator';
import { Device } from '../shared/types';
import { cn, formatTimestamp } from '../shared/utils';
import { useDeviceStore } from '../state/stores/useDeviceStore';

export function DevicesPage() {
  const navigate = useNavigate();
  const { devices, setDevices, setSelectedDevice } = useDeviceStore();
  const [pairingDialogOpen, setPairingDialogOpen] = React.useState(false);
  const [isPairing, setIsPairing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Real device loading - single device DEV00
  React.useEffect(() => {
    const realDevice: Device = {
      id: 'DEV00',
      name: 'BOBOBEE TestType',
      status: 'ONLINE',
      firmwareVersion: '2.1.4',
      lastSeen: new Date(),
      ownerId: 'user123',
    };
    setDevices([realDevice]);
  }, [setDevices]);

  const handlePairDevice = async (data: { deviceId: string; claimCode?: string }) => {
    setIsPairing(true);
    setError(null);

    try {
      // Simulate pairing process
      await new Promise(resolve => setTimeout(resolve, 800));

      // Add new device
      const newDevice = MockDataGenerator.generateDevice(data.deviceId);
      newDevice.status = 'ONLINE'; // Successfully paired
      setDevices([...devices, newDevice]);
    } catch (error) {
      setError('Failed to pair device. Please check the Device ID and try again.');
      throw error;
    } finally {
      setIsPairing(false);
    }
  };

  const handleDeviceClick = (device: Device) => {
    setSelectedDevice(device.id);
    navigate(`/d/${device.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/landing')}
            className="flex items-center gap-2 text-amber-700 hover:text-amber-800 hover:bg-amber-50 transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Button>

          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            Your Devices
          </h1>
          <p className="text-amber-700/70 text-sm">
            Manage and monitor your BoBoBee devices
          </p>

          <Button
            onClick={() => setPairingDialogOpen(true)}
            className="mt-1 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 shadow-md transition-all duration-200"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        </div>

        {error && (
          <div className="mx-auto max-w-md mb-5 p-3 text-red-700 bg-red-50 border border-red-200 rounded-xl shadow-sm text-sm">
            {error}
          </div>
        )}

        <div className="mx-auto max-w-md">
          <div className="flex justify-center">
            {devices.map((device) => (
              <div key={device.id} className="w-full max-w-sm">
                <DeviceCard device={device} onClick={() => handleDeviceClick(device)} />
              </div>
            ))}
          </div>
        </div>

        <PairDeviceDialog
          open={pairingDialogOpen}
          onOpenChange={setPairingDialogOpen}
          onSubmit={handlePairDevice}
          isLoading={isPairing}
        />
      </div>
    </div>
  );
}

interface DeviceCardProps {
  device: Device;
  onClick: () => void;
}

function DeviceCard({ device, onClick }: DeviceCardProps) {
  const isOnline = device.status === 'ONLINE';

  return (
    <Card
      className={cn(
        'h-full cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 bg-white/95 backdrop-blur-sm border-0 shadow-md',
        !isOnline && 'opacity-80'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{device.name}</CardTitle>
          <Badge
            className={cn(
              'text-[10px] font-medium px-2.5 py-0.5 rounded-full',
              device.status === 'ONLINE' && 'bg-green-100 text-green-700 border border-green-200',
              device.status === 'OFFLINE' && 'bg-gray-100 text-gray-700 border border-gray-200',
              device.status === 'PAIRING' && 'bg-yellow-100 text-yellow-700 border border-yellow-200'
            )}
          >
            {device.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          <Row label="Device ID" value={<span className="font-mono">{device.id}</span>} />
          <Row label="Firmware" value={`v${device.firmwareVersion}`} />
          <Row
            label={
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last seen
              </span>
            }
            value={formatTimestamp(device.lastSeen)}
          />

          <div className="pt-2 mt-1 border-t">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-700 font-medium">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-red-700 font-medium">Offline</span>  
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-7 w-7 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle settings click
                }}
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right ml-3">{value}</span>
    </div>
  );
}



