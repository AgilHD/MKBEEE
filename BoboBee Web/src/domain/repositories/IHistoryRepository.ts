import { HistoryData } from '../../shared/types';

export interface IHistoryRepository {
  getDay(deviceId: string, date: string): Promise<HistoryData>; // date: YYYY-MM-DD
}