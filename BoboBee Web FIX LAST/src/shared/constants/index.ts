export const API_BASE_URL = 'http://localhost:3001';
export const WS_URL = 'ws://localhost:3001/ws';

export const ALERT_COLORS = {
  PRONE: 'bg-red-100 text-red-800 border-red-200',
  CRY: 'bg-orange-100 text-orange-800 border-orange-200',
  OVERHEAT: 'bg-red-100 text-red-800 border-red-200',
} as const;

export const POSTURE_COLORS = {
  Supine: 'bg-green-100 text-green-800',
  Prone: 'bg-red-100 text-red-800',
  Unknown: 'bg-gray-100 text-gray-800',
} as const;

export const DEVICE_STATUS_COLORS = {
  ONLINE: 'bg-green-100 text-green-800',
  OFFLINE: 'bg-gray-100 text-gray-800',
  PAIRING: 'bg-yellow-100 text-yellow-800',
} as const;

export const SNOOZE_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
];

export const REFRESH_INTERVALS = {
  LIVE_DATA: 2000, // 2 seconds
  DEVICE_STATUS: 10000, // 10 seconds
  HISTORY: 30000, // 30 seconds
} as const;