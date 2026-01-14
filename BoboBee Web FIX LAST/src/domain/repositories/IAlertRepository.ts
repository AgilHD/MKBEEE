import { Alert } from '../../shared/types';

export interface IAlertRepository {
  getRecent(deviceId: string, limit?: number): Promise<Alert[]>;
  acknowledge(deviceId: string, alertId: string): Promise<void>;
  snooze(deviceId: string, alertId: string, minutes: number): Promise<void>;
}