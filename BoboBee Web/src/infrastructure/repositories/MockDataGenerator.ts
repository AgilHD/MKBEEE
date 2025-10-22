import { 
  Device, 
  Alert, 
  AudioTrack, 
  QuickConfig, 
  HistoryData, 
  PostureReading,
  SensorReading,
  PairingTicket
} from '../../shared/types';

// Mock data generator for development
export class MockDataGenerator {
  static generateDevice(id: string): Device {
    return {
      id,
      name: `BoBoBee ${id.slice(-4)}`,
      status: Math.random() > 0.8 ? 'OFFLINE' : 'ONLINE',
      firmwareVersion: '2.1.4',
      lastSeen: new Date(Date.now() - Math.random() * 300000), // Random within last 5 minutes
      ownerId: 'user123',
    };
  }

  static generateAlerts(deviceId: string, count = 10): Alert[] {
    const types = ['PRONE', 'CRY', 'OVERHEAT'] as const;
    return Array.from({ length: count }, (_, i) => ({
      id: `alert_${deviceId}_${i}`,
      type: types[Math.floor(Math.random() * types.length)],
      deviceId,
      timestamp: new Date(Date.now() - Math.random() * 86400000), // Random within last day
      durationMs: Math.random() * 60000,
      acknowledged: Math.random() > 0.7,
      snoozeUntil: Math.random() > 0.9 ? new Date(Date.now() + 300000) : undefined,
      message: 'Alert detected by monitoring system',
    }));
  }

  static generateAudioTracks(deviceId: string): AudioTrack[] {
    return [
      {
        id: 'track1',
        title: 'Gentle Rain',
        type: 'whiteNoise',
        lengthSeconds: 3600,
        deviceId,
      },
      {
        id: 'track2',
        title: 'Brahms Lullaby',
        type: 'lullaby',
        lengthSeconds: 180,
        deviceId,
      },
      {
        id: 'track3',
        title: 'Ocean Waves',
        type: 'whiteNoise',
        lengthSeconds: 2400,
        deviceId,
      },
    ];
  }

  static generateQuickConfig(): QuickConfig {
    return {
      tempThreshold: 25.0,
      rhThreshold: 70,
      smoothingNofM: 3,
      delayMs: 30000,
      cooldownMs: 300000,
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      autoResponseEnabled: true,
    };
  }

  static generatePostureReading(): PostureReading {
    const statuses = ['Supine', 'Prone', 'Unknown'] as const;
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    return {
      status,
      confidence: status === 'Unknown' ? 0 : Math.random() * 100,
      timestamp: new Date(),
    };
  }

  static generateSensorReading(): SensorReading {
    const tempC = 20 + Math.random() * 10;
    const rh = 40 + Math.random() * 40;
    return {
      tempC,
      rh,
      timestamp: new Date(),
      isSafe: tempC < 26 && rh < 80,
    };
  }

  static generateHistoryData(): HistoryData {
    const now = new Date();
    const timeline = [];
    
    for (let i = 0; i < 144; i++) { // 24 hours * 6 (10-minute intervals)
      const timestamp = new Date(now.getTime() - (144 - i) * 10 * 60 * 1000);
      const statuses = ['Supine', 'Prone', 'Unknown'] as const;
      const posture = statuses[Math.floor(Math.random() * statuses.length)];
      
      timeline.push({
        timestamp,
        posture,
        confidence: posture === 'Unknown' ? 0 : 70 + Math.random() * 30,
        cry: Math.floor(Math.random() * 4),
        tempC: 22 + Math.random() * 4,
        rh: 50 + Math.random() * 20,
      });
    }
    
    return { timeline };
  }

  static generatePairingTicket(deviceId: string): PairingTicket {
    return {
      deviceId,
      claimCode: Math.random().toString(36).substr(2, 6).toUpperCase(),
      expiresAt: new Date(Date.now() + 300000), // 5 minutes
      status: 'PENDING',
    };
  }
}