import { IPairingRepository, PairingRequest } from '../../domain/repositories/IPairingRepository';
import { PairingTicket } from '../../shared/types';
import { validateDeviceId } from '../../shared/utils';

export class PairingService {
  constructor(private pairingRepo: IPairingRepository) {}

  async startPairing(deviceId: string, claimCode?: string): Promise<PairingTicket> {
    if (!validateDeviceId(deviceId)) {
      throw new Error('Invalid Device ID format. Expected format: DEVXXXXXXXXX');
    }

    return this.pairingRepo.start({ deviceId, claimCode });
  }

  async confirmPairing(deviceId: string, code?: string): Promise<void> {
    return this.pairingRepo.confirm(deviceId, code);
  }

  async getPairingStatus(deviceId: string): Promise<PairingTicket> {
    return this.pairingRepo.getStatus(deviceId);
  }

  parseQRCode(qrData: string): { deviceId: string; claimCode?: string } | null {
    try {
      // Expected format: "bobobee://pair?device=DEVXXXXXXXXX&code=XXXX"
      const url = new URL(qrData);
      if (url.protocol !== 'bobobee:' || url.pathname !== '//pair') {
        return null;
      }
      
      const deviceId = url.searchParams.get('device');
      const claimCode = url.searchParams.get('code') || undefined;
      
      if (!deviceId || !validateDeviceId(deviceId)) {
        return null;
      }
      
      return { deviceId, claimCode };
    } catch {
      return null;
    }
  }
}