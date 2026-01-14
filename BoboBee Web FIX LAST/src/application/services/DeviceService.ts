import { IDeviceRepository } from '../../domain/repositories/IDeviceRepository';
import { Device } from '../../shared/types';

export class DeviceService {
  constructor(private deviceRepo: IDeviceRepository) {}

  async getDevices(): Promise<Device[]> {
    return this.deviceRepo.listMine();
  }

  async getDevice(deviceId: string): Promise<Device> {
    return this.deviceRepo.get(deviceId);
  }

  async renameDevice(deviceId: string, name: string): Promise<void> {
    if (!name.trim()) {
      throw new Error('Device name cannot be empty');
    }
    return this.deviceRepo.rename(deviceId, name.trim());
  }

  async removeDevice(deviceId: string): Promise<void> {
    return this.deviceRepo.remove(deviceId);
  }
}