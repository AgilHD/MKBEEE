import { QuickConfig } from '../../shared/types';

export interface IConfigRepository {
  get(deviceId: string): Promise<QuickConfig>;
  update(deviceId: string, config: Partial<QuickConfig>): Promise<void>;
}