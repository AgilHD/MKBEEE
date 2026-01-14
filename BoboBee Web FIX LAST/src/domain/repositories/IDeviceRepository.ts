import { Device } from '../../shared/types';

export interface IDeviceRepository {
  listMine(): Promise<Device[]>;
  get(deviceId: string): Promise<Device>;
  rename(deviceId: string, name: string): Promise<void>;
  remove(deviceId: string): Promise<void>;
}