import { IDeviceRepository } from '../../domain/repositories/IDeviceRepository';
import { Device } from '../../shared/types';
import { HttpClient } from '../http/HttpClient';

export class HttpDeviceRepository implements IDeviceRepository {
  constructor(private httpClient: HttpClient) {}

  async listMine(): Promise<Device[]> {
    const devices = await this.httpClient.get<Device[]>('/devices');
    return devices.map(device => ({
      ...device,
      lastSeen: new Date(device.lastSeen),
    }));
  }

  async get(deviceId: string): Promise<Device> {
    const device = await this.httpClient.get<Device>(`/devices/${deviceId}`);
    return {
      ...device,
      lastSeen: new Date(device.lastSeen),
    };
  }

  async rename(deviceId: string, name: string): Promise<void> {
    return this.httpClient.patch<void>(`/devices/${deviceId}/rename`, { name });
  }

  async remove(deviceId: string): Promise<void> {
    return this.httpClient.delete<void>(`/devices/${deviceId}`);
  }
}