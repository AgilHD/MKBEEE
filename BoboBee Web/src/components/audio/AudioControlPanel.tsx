import React from 'react';
import { Play, Pause, Volume2, VolumeX, SkipForward, SkipBack } from 'lucide-react';
import { AudioTrack } from '../../shared/types';
import { MockDataGenerator } from '../../infrastructure/repositories/MockDataGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import { cn } from '../../shared/utils';

interface AudioControlPanelProps {
  deviceId: string;
  className?: string;
}

export function AudioControlPanel({ deviceId, className }: AudioControlPanelProps) {
  const [tracks] = React.useState<AudioTrack[]>(MockDataGenerator.generateAudioTracks(deviceId));
  const [currentTrack, setCurrentTrack] = React.useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [volume, setVolume] = React.useState([75]);
  const [isMuted, setIsMuted] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);

  // Simulate playback progress
  React.useEffect(() => {
    if (isPlaying && currentTrack) {
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= currentTrack.lengthSeconds) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, currentTrack]);

  const handlePlay = (track: AudioTrack) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleNext = () => {
    if (!currentTrack) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    const nextTrack = tracks[(currentIndex + 1) % tracks.length];
    setCurrentTrack(nextTrack);
    setCurrentTime(0);
  };

  const handlePrevious = () => {
    if (!currentTrack) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    const prevTrack = tracks[(currentIndex - 1 + tracks.length) % tracks.length];
    setCurrentTrack(prevTrack);
    setCurrentTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTrackTypeColor = (type: string) => {
    return type === 'lullaby' 
      ? 'bg-purple-100 text-purple-800' 
      : 'bg-blue-100 text-blue-800';
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Current Playing */}
      {currentTrack && (
        <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-amber-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
              Now Playing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{currentTrack.title}</h3>
                <Badge className={getTrackTypeColor(currentTrack.type)}>
                  {currentTrack.type === 'lullaby' ? 'Lullaby' : 'White Noise'}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(currentTrack.lengthSeconds)}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Slider
                value={[currentTime]}
                max={currentTrack.lengthSeconds}
                step={1}
                className="w-full"
                onValueChange={([value]) => setCurrentTime(value)}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" onClick={handlePrevious}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button variant="outline" size="icon" onClick={handleNext}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Volume Control */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            Volume Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={isMuted ? [0] : volume}
              max={100}
              step={1}
              className="flex-1"
              onValueChange={setVolume}
              disabled={isMuted}
            />
            <span className="text-sm text-muted-foreground w-12">
              {isMuted ? '0%' : `${volume[0]}%`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Track Library */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Audio Library</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tracks.map((track) => (
            <div
              key={track.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer",
                currentTrack?.id === track.id 
                  ? "bg-amber-50 border-amber-200" 
                  : "bg-white hover:bg-gray-50"
              )}
              onClick={() => handlePlay(track)}
            >
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                >
                  {currentTrack?.id === track.id && isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <div>
                  <h4 className="font-medium">{track.title}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge className={getTrackTypeColor(track.type)} variant="secondary">
                      {track.type === 'lullaby' ? 'Lullaby' : 'White Noise'}
                    </Badge>
                    <span>{formatTime(track.lengthSeconds)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              onClick={handleStop}
              disabled={!currentTrack}
              className="w-full"
            >
              Stop All Audio
            </Button>
            <Button 
              variant="outline"
              onClick={() => handlePlay(tracks[0])}
              className="w-full"
            >
              Play Default Lullaby
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}