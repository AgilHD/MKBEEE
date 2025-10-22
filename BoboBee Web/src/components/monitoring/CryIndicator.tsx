import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../shared/utils';

interface CryIndicatorProps {
  level: 0 | 1 | 2 | 3;
  vadActive: boolean;
  className?: string;
}

const CRY_LABELS = {
  0: 'Quiet',
  1: 'Fussing',
  2: 'Crying',
  3: 'Intense',
} as const;

const CRY_COLORS = {
  0: 'bg-green-100 text-green-800',
  1: 'bg-yellow-100 text-yellow-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-red-100 text-red-800',
} as const;

export function CryIndicator({ level, vadActive, className }: CryIndicatorProps) {
  const [prevLevel, setPrevLevel] = React.useState(level);
  
  React.useEffect(() => {
    setPrevLevel(level);
  }, [level]);

  const hasChanged = level !== prevLevel && level > 1;

  return (
    <Card className={cn(
      "transition-all duration-300 bg-white/90 backdrop-blur-sm shadow-xl border-0",
      hasChanged && "ring-2 ring-orange-400 shadow-orange-200/50 animate-pulse",
      className
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
          {vadActive ? (
            <Volume2 className={cn(
              "h-5 w-5",
              level > 1 ? "text-orange-500 animate-pulse" : "text-amber-500"
            )} />
          ) : (
            <VolumeX className="h-5 w-5 text-gray-400" />
          )}
          Cry Detection
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge className={cn('text-base px-3 py-1', CRY_COLORS[level])}>
              {CRY_LABELS[level]}
            </Badge>
            <div className="text-sm text-amber-700/70 font-medium">
              Level {level}/3
            </div>
          </div>

          {/* Visual level indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-amber-700/70">
              <span>Quiet</span>
              <span>Intense</span>
            </div>
            <div className="flex gap-1 h-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-sm transition-all duration-300",
                    i <= level 
                      ? i <= 1 
                        ? "bg-green-400" 
                        : i === 2 
                        ? "bg-orange-400" 
                        : "bg-red-400"
                      : "bg-gray-200"
                  )}
                />
              ))}
            </div>
          </div>

          {level > 1 && (
            <div 
              role="status" 
              aria-live="assertive" 
              className="p-4 bg-orange-50 rounded-xl border border-orange-200 shadow-sm"
            >
              <div className="text-sm text-orange-700">
                <strong>Alert:</strong> Baby crying detected ({CRY_LABELS[level]})
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}