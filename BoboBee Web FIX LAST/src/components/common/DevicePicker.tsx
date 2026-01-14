import { ChevronDown } from 'lucide-react';
import React from 'react';
import { Device } from '../../shared/types';
import { cn } from '../../shared/utils';
import { useDeviceStore } from '../../state/stores/useDeviceStore';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface DevicePickerProps {
  devices: Device[];
  className?: string;
}

export function DevicePicker({ devices, className }: DevicePickerProps) {
  const { selectedDeviceId, wsConnected, setSelectedDevice } = useDeviceStore();
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="min-w-[200px] justify-between border-amber-200 hover:bg-amber-50 hover:border-amber-300 transition-colors bg-white/90 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <span>{selectedDevice?.name || 'Select Device'}</span>
          {selectedDevice && (
            <Badge 
              className={cn(
                'text-xs font-medium px-2 py-1 rounded-full border',
                selectedDevice.status === 'ONLINE' && 'bg-green-100 text-green-700 border-green-200',
                selectedDevice.status === 'OFFLINE' && 'bg-gray-100 text-gray-700 border-gray-200',
                selectedDevice.status === 'PAIRING' && 'bg-yellow-100 text-yellow-700 border-yellow-200'
              )}
            >
              {selectedDevice.status}
            </Badge>
          )}
        </div>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[300px] rounded-xl border border-amber-200 bg-white/95 backdrop-blur-sm shadow-xl">
            <div className="p-2">
              {devices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => {
                    setSelectedDevice(device.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-lg hover:bg-amber-50 transition-colors",
                    selectedDeviceId === device.id && "bg-amber-50 border border-amber-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{device.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {device.id} • v{device.firmwareVersion}
                      </div>
                    </div>
                    <Badge 
                      className={cn(
                        'text-xs font-medium px-2 py-1 rounded-full border',
                        device.status === 'ONLINE' && 'bg-green-100 text-green-700 border-green-200',
                        device.status === 'OFFLINE' && 'bg-gray-100 text-gray-700 border-gray-200',
                        device.status === 'PAIRING' && 'bg-yellow-100 text-yellow-700 border-yellow-200'
                      )}
                    >
                      {device.status}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}