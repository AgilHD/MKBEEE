import React from 'react';
import { Volume2, VolumeX, WifiOff, RefreshCw, Edit3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../shared/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useCryDetection } from '../../services/cry-detection/CryDetectionService';

interface CryIndicatorProps {
  className?: string;
}

export function CryIndicator({ className }: CryIndicatorProps) {
  // Integrasi service audio
  const { state, connect, setEspHost } = useCryDetection()
  const [editing, setEditing] = React.useState(false)
  const [hostDraft, setHostDraft] = React.useState(state.espHost)

  const isOn = state.micStatus === 'on'
  const isConnecting = state.micStatus === 'connecting'
  const isError = state.micStatus === 'error'

  const labelText = state.label || (state.isCrying ? 'Menangis' : 'Tidak Menangis')
  const labelColor = state.isCrying ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'

  const confidencePct = Math.max(0, Math.min(100, state.confidence))
  const hasChanged = state.isCrying

  return (
    <Card className={cn(
      "transition-all duration-300 bg-white/90 backdrop-blur-sm shadow-xl border-0",
      hasChanged && "ring-2 ring-orange-400 shadow-orange-200/50 animate-pulse",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            {isOn ? (
              <Volume2 className={cn(
                'h-5 w-5',
                state.isCrying ? 'text-red-500 animate-pulse' : 'text-amber-500'
              )} />
            ) : (
              <VolumeX className={cn('h-5 w-5', isError ? 'text-red-400' : 'text-gray-400')} />
            )}
            Cry Detection
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs px-2 py-1',
              isOn && 'bg-green-100 text-green-800',
              isConnecting && 'bg-yellow-100 text-yellow-800',
              isError && 'bg-red-100 text-red-800',
              !isOn && !isConnecting && !isError && 'bg-gray-100 text-gray-700'
            )}>
              Mic: {isOn ? 'ON' : isConnecting ? 'CONNECTING' : isError ? 'ERROR' : 'OFF'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge className={cn('text-base px-3 py-1', labelColor)}>
              {labelText}
            </Badge>
            <div className="text-sm text-amber-700/70 font-medium">
              {confidencePct}%
            </div>
          </div>

          {/* Confidence bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-amber-700/70">
              <span>Tidak Menangis</span>
              <span>Menangis</span>
            </div>
            <div className="w-full bg-gray-200/70 rounded-full h-2">
              <div
                className={cn('h-2 rounded-full transition-all duration-500', state.isCrying ? 'bg-red-500' : 'bg-green-500')}
                style={{ width: `${state.isCrying ? confidencePct : Math.max(0, 100 - confidencePct)}%` }}
              />
            </div>
          </div>

          {state.isCrying && (
            <div 
              role="status" 
              aria-live="assertive" 
              className="p-4 bg-orange-50 rounded-xl border border-orange-200 shadow-sm"
            >
              <div className="text-sm text-orange-700">
                <strong>Alert:</strong> Baby crying detected ({labelText})
              </div>
            </div>
          )}

          {/* Controls: ESP host + reconnect */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-amber-700/70">
              {isOn ? <Volume2 className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {!editing ? (
                <span>ESP: {state.espHost}</span>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={hostDraft} onChange={(e) => setHostDraft(e.target.value)} className="h-7 w-40" />
                  <Button size="sm" variant="outline" className="h-7" onClick={() => { setEspHost(hostDraft); connect(hostDraft); setEditing(false) }}>Save</Button>
                </div>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit ESP IP" onClick={() => { setHostDraft(state.espHost); setEditing(v => !v) }}>
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {state.micStatus !== 'on' && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => connect()}>
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1', isConnecting && 'animate-spin')} />
                Reconnect
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}