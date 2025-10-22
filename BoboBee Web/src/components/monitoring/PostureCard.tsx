import React from 'react';
import { Baby, AlertTriangle } from 'lucide-react';
import { PostureStatus } from '../../shared/types';
import { POSTURE_COLORS } from '../../shared/constants';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../shared/utils';

interface PostureCardProps {
  posture: PostureStatus;
  confidence: number;
  className?: string;
}

export function PostureCard({ posture, confidence, className }: PostureCardProps) {
  const isProne = posture === 'Prone';
  const isUnknown = posture === 'Unknown';
  
  return (
    <Card className={cn(
      "transition-all duration-300 bg-white/90 backdrop-blur-sm shadow-xl border-0",
      isProne && "ring-2 ring-red-400 shadow-red-200/50 animate-pulse",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            <Baby className={cn(
              "h-5 w-5",
              isProne ? "text-red-500" : "text-amber-500"
            )} />
            Sleep Position
          </CardTitle>
          {isProne && (
            <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge 
              className={cn(
                'text-base px-4 py-2 font-medium rounded-full border',
                posture === 'Supine' && 'bg-green-100 text-green-700 border-green-200',
                posture === 'Prone' && 'bg-red-100 text-red-700 border-red-200',
                posture === 'Unknown' && 'bg-gray-100 text-gray-700 border-gray-200'
              )}
            >
              {posture}
            </Badge>
            {!isUnknown && (
              <div className="text-sm text-amber-700/70 font-medium">
                {Math.round(confidence)}% confident
              </div>
            )}
          </div>
          
          {isProne && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 shadow-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <strong>Warning:</strong> Baby is in prone position. Consider checking immediately.
                </div>
              </div>
            </div>
          )}
          
          {isUnknown && (
            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 shadow-sm">
              <div className="text-sm text-yellow-700">
                Position detection unclear. Camera may need adjustment.
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}