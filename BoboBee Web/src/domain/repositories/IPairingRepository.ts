import { PairingTicket } from '../../shared/types';

export interface PairingRequest {
  deviceId: string;
  claimCode?: string;
}

export interface IPairingRepository {
  start(request: PairingRequest): Promise<PairingTicket>;
  confirm(deviceId: string, code?: string): Promise<void>;
  getStatus(deviceId: string): Promise<PairingTicket>;
}