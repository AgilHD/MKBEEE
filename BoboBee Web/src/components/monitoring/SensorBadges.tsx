import React from 'react';
import { Thermometer, Droplets, Shield, AlertTriangle } from 'lucide-react';
import { SensorReading } from '../../shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../shared/utils';

interface SensorBadgesProps {
  reading: SensorReading;
  thresholds: {
    tempC: number;
    rh: number;
  };
  className?: string;
}

export function SensorBadges({ reading, thresholds, className }: SensorBadgesProps) {
  const tempWarning = reading.tempC > thresholds.tempC;
  const humidityWarning = reading.rh > thresholds.rh;
  const hasWarnings = tempWarning || humidityWarning;

  return (
    <Card className={cn(
      "transition-all duration-300 bg-white/90 backdrop-blur-sm shadow-xl border-0",
      hasWarnings && "ring-2 ring-amber-400 shadow-amber-200/50",
      className
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
          {reading.isSafe ? (
            <Shield className="h-5 w-5 text-green-500 drop-shadow-sm" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500 drop-shadow-sm animate-pulse" />
          )}
          Environment
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4">
          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Thermometer className={cn(
                "h-4 w-4",
                tempWarning ? "text-red-500" : "text-blue-500"
              )} />
              <span className="text-sm font-medium">Temperature</span>
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              {reading.tempC.toFixed(1)}°C
            </div>
            <Badge 
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-full border",
                tempWarning 
                  ? "bg-red-100 text-red-700 border-red-200" 
                  : "bg-green-100 text-green-700 border-green-200"
              )}
            >
              {tempWarning ? "Above threshold" : "Normal"}
            </Badge>
          </div>

          {/* Humidity */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Droplets className={cn(
                "h-4 w-4",
                humidityWarning ? "text-orange-500" : "text-cyan-500"
              )} />
              <span className="text-sm font-medium">Humidity</span>
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              {Math.round(reading.rh)}%
            </div>
            <Badge 
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-full border",
                humidityWarning 
                  ? "bg-orange-100 text-orange-700 border-orange-200" 
                  : "bg-green-100 text-green-700 border-green-200"
              )}
            >
              {humidityWarning ? "Above threshold" : "Normal"}
            </Badge>
          </div>
        </div>

        {hasWarnings && (
          <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200 shadow-sm">
            <div className="text-sm text-amber-700">
              <strong>Warning:</strong> Environmental conditions are outside safe ranges.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}