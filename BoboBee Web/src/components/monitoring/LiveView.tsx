import React from 'react';
import { Maximize, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../../shared/utils';

interface LiveViewProps {
  src: string;
  onFullscreen?: () => void;
  className?: string;
}

export function LiveView({ src, onFullscreen, className }: LiveViewProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState(new Date());
  const imgRef = React.useRef<HTMLImageElement>(null);

  const handleImageLoad = React.useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    setLastUpdate(new Date());
  }, []);

  const handleImageError = React.useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const refreshImage = React.useCallback(() => {
    if (imgRef.current) {
      setIsLoading(true);
      setHasError(false);
      imgRef.current.src = `${src}?t=${Date.now()}`;
    }
  }, [src]);

  React.useEffect(() => {
    // Auto-refresh every 2 seconds for MJPEG-like behavior
    const interval = setInterval(refreshImage, 2000);
    return () => clearInterval(interval);
  }, [refreshImage]);

  return (
    <Card className={cn("overflow-hidden bg-white/90 backdrop-blur-sm shadow-xl border-0", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            Live View
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <div className="text-sm text-amber-700/70">
              {lastUpdate.toLocaleTimeString()}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshImage}
              disabled={isLoading}
              className="hover:bg-amber-50 hover:text-amber-600"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            {onFullscreen && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onFullscreen}
                className="hover:bg-amber-50 hover:text-amber-600"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative aspect-video bg-gradient-to-br from-amber-50 to-yellow-100">
          {hasError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-600/70">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">Camera unavailable</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshImage} 
                className="mt-2 border-amber-200 hover:bg-amber-50"
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              <img
                ref={imgRef}
                src={src}
                alt="Live camera feed"
                onLoad={handleImageLoad}
                onError={handleImageError}
                className="w-full h-full object-cover"
              />
              {isLoading && (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-yellow-100 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}