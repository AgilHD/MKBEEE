import { create } from 'zustand';
import { Device } from '../../shared/types';

interface DeviceState {
  selectedDeviceId: string | null;
  devices: Device[];
  wsConnected: boolean;
  setSelectedDevice: (deviceId: string | null) => void;
  setDevices: (devices: Device[]) => void;
  updateDevice: (device: Device) => void;
  setWsConnected: (connected: boolean) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  selectedDeviceId: null,
  devices: [],
  wsConnected: false,
  setSelectedDevice: (deviceId) => set({ selectedDeviceId: deviceId }),
  setDevices: (devices) => set({ devices }),
  updateDevice: (device) => set((state) => ({
    devices: state.devices.map(d => d.id === device.id ? device : d)
  })),
  setWsConnected: (wsConnected) => set({ wsConnected }),
}));