// Shared Types and Enums
export type Role = 'OWNER' | 'GUARDIAN' | 'VIEWER';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'PAIRING';
export type PostureStatus = 'Supine' | 'Prone' | 'Unknown';
export type AlertType = 'PRONE' | 'CRY' | 'OVERHEAT';
export type AudioTrackType = 'lullaby' | 'whiteNoise';

export interface User {
  id: string;
  email: string;
  roles: Role[];
}

export interface Device {
  id: string;
  name: string;
  status: DeviceStatus;
  firmwareVersion: string;
  lastSeen: Date;
  ownerId: string;
}

export interface SensorReading {
  tempC: number;
  rh: number;
  timestamp: Date;
  isSafe: boolean;
}

export interface PostureReading {
  status: PostureStatus;
  confidence: number;
  timestamp: Date;
}

export interface CryEvent {
  id: string;
  start: Date;
  end?: Date;
  intensity: 0 | 1 | 2 | 3;
  deviceId: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  deviceId: string;
  timestamp: Date;
  durationMs?: number;
  acknowledged: boolean;
  snoozeUntil?: Date;
  message: string;
}

export interface AudioTrack {
  id: string;
  title: string;
  type: AudioTrackType;
  lengthSeconds: number;
  deviceId: string;
}

export interface QuickConfig {
  tempThreshold: number;
  rhThreshold: number;
  smoothingNofM: number;
  delayMs: number;
  cooldownMs: number;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "06:00"
  autoResponseEnabled: boolean;
}

export interface PairingTicket {
  deviceId: string;
  claimCode?: string;
  expiresAt: Date;
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
}

export interface HistoryData {
  timeline: {
    timestamp: Date;
    posture: PostureStatus;
    confidence: number;
    cry: number;
    tempC: number;
    rh: number;
  }[];
}

// WebSocket Events
export interface WSEvent {
  type: 'DEVICE_STATUS' | 'POSTURE' | 'CRY' | 'ENV' | 'ALERT_NEW' | 'ALERT_UPDATE' | 'PAIRING_CONFIRMED' | 'AUDIO_STATE' | 'CONFIG_UPDATED';
  deviceId: string;
  data: any;
  timestamp: Date;
}