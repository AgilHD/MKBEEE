import { AudioTrack } from '../../shared/types';

export interface AudioState {
  playing: boolean;
  currentTrackId?: string;
  volume: number;
  timestamp: Date;
}

export interface IAudioRepository {
  getTracks(deviceId: string): Promise<AudioTrack[]>;
  play(deviceId: string, trackId: string): Promise<void>;
  stop(deviceId: string): Promise<void>;
  setVolume(deviceId: string, volume: number): Promise<void>;
  getState(deviceId: string): Promise<AudioState>;
}