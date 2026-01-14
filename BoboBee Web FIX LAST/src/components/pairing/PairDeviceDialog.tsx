import React from 'react';
import { QrCode, Loader2 } from 'lucide-react';
import { validateDeviceId } from '../../shared/utils';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface PairDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { deviceId: string; claimCode?: string }) => Promise<void>;
  isLoading?: boolean;
}

export function PairDeviceDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isLoading = false 
}: PairDeviceDialogProps) {
  const [deviceId, setDeviceId] = React.useState('');
  const [claimCode, setClaimCode] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('manual');
  const [qrError, setQrError] = React.useState<string | null>(null);

  const isValidDeviceId = validateDeviceId(deviceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidDeviceId) return;

    try {
      await onSubmit({ 
        deviceId: deviceId.toUpperCase(), 
        claimCode: claimCode.trim() || undefined 
      });
      setDeviceId('');
      setClaimCode('');
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent component
    }
  };

  const handleQRScan = async () => {
    try {
      // In a real implementation, this would use the camera API
      // For now, we'll simulate QR code scanning
      const mockQRData = "bobobee://pair?device=DEV123456789&code=ABC123";
      
      // Parse QR code data
      const url = new URL(mockQRData);
      const qrDeviceId = url.searchParams.get('device');
      const qrClaimCode = url.searchParams.get('code');
      
      if (qrDeviceId && validateDeviceId(qrDeviceId)) {
        setDeviceId(qrDeviceId);
        setClaimCode(qrClaimCode || '');
        setActiveTab('manual');
        setQrError(null);
      } else {
        setQrError('Invalid QR code format');
      }
    } catch (error) {
      setQrError('Failed to scan QR code');
    }
  };

  React.useEffect(() => {
    if (!open) {
      setDeviceId('');
      setClaimCode('');
      setActiveTab('manual');
      setQrError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add BoBoBee Device</DialogTitle>
          <DialogDescription>
            Connect a new BoBoBee device to your account using the Device ID or QR code.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="qr">QR Code</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="deviceId" className="text-sm font-medium">
                  Device ID *
                </label>
                <Input
                  id="deviceId"
                  placeholder="DEVXXXXXXXXX"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                  className={!isValidDeviceId && deviceId ? 'border-red-500' : ''}
                  disabled={isLoading}
                />
                {!isValidDeviceId && deviceId && (
                  <p className="text-sm text-red-500">
                    Invalid format. Expected: DEVXXXXXXXXX
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="claimCode" className="text-sm font-medium">
                  Claim Code (Optional)
                </label>
                <Input
                  id="claimCode"
                  placeholder="Enter claim code if provided"
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isValidDeviceId || isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Pairing...
                    </>
                  ) : (
                    'Pair Device'
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="qr" className="space-y-4">
            <div className="text-center space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 bg-gray-50">
                <QrCode className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm text-gray-600 mb-4">
                  Scan the QR code on your BoBoBee device
                </p>
                <Button onClick={handleQRScan} variant="outline">
                  Start Camera Scan
                </Button>
              </div>
              
              {qrError && (
                <p className="text-sm text-red-500">{qrError}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
