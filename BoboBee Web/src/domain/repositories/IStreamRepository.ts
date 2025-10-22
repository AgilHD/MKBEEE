import { PostureReading, SensorReading } from '../../shared/types';

export interface IStreamRepository {
  getSnapshot(deviceId: string): Promise<string>; // Returns image URL
  getPosture(deviceId: string): Promise<PostureReading>;
  getCryLevel(deviceId: string): Promise<{ level: 0 | 1 | 2 | 3; vadActive: boolean; timestamp: Date }>;
  getEnvironment(deviceId: string): Promise<SensorReading>;
}