import React from 'react';
import { AlertTriangle, Clock, CheckCircle, SunSnow as Snooze } from 'lucide-react';
import { Alert } from '../../shared/types';
import { ALERT_COLORS, SNOOZE_OPTIONS } from '../../shared/constants';
import { formatTimestamp, formatDuration } from '../../shared/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../shared/utils';

interface AlertLogProps {
  items: Alert[];
  onAck: (alertId: string) => void;
  onSnooze: (alertId: string, minutes: number) => void;
  className?: string;
}

export function AlertLog({ items, onAck, onSnooze, className }: AlertLogProps) {
  const [snoozeMenuId, setSnoozeMenuId] = React.useState<string | null>(null);
  
  const activeAlerts = items.filter(alert => 
    !alert.acknowledged && 
    (!alert.snoozeUntil || alert.snoozeUntil < new Date())
  );
  
  const acknowledgedAlerts = items.filter(alert => alert.acknowledged);
  const snoozedAlerts = items.filter(alert => 
    alert.snoozeUntil && alert.snoozeUntil > new Date()
  );

  return (
    <Card className={cn("bg-white/90 backdrop-blur-sm shadow-xl border-0", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Alerts
          {activeAlerts.length > 0 && (
            <Badge className="ml-auto bg-red-100 text-red-700 border border-red-200 font-medium">
              {activeAlerts.length} active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Active Alerts */}
          {activeAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Active Alerts
              </h4>
              {activeAlerts.map((alert) => (
                <AlertItem 
                  key={alert.id}
                  alert={alert}
                  onAck={() => onAck(alert.id)}
                  onSnooze={(minutes) => onSnooze(alert.id, minutes)}
                  snoozeMenuOpen={snoozeMenuId === alert.id}
                  onSnoozeMenuToggle={() => setSnoozeMenuId(snoozeMenuId === alert.id ? null : alert.id)}
                  variant="active"
                />
              ))}
            </div>
          )}

          {/* Snoozed Alerts */}
          {snoozedAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-700 flex items-center gap-2">
                <Snooze className="h-4 w-4" />
                Snoozed
              </h4>
              {snoozedAlerts.map((alert) => (
                <AlertItem 
                  key={alert.id}
                  alert={alert}
                  variant="snoozed"
                />
              ))}
            </div>
          )}

          {/* Recent Acknowledged */}
          {acknowledgedAlerts.slice(0, 5).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-green-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Recent (Acknowledged)
              </h4>
              {acknowledgedAlerts.slice(0, 5).map((alert) => (
                <AlertItem 
                  key={alert.id}
                  alert={alert}
                  variant="acknowledged"
                />
              ))}
            </div>
          )}

          {items.length === 0 && (
            <div className="text-center py-8 text-amber-600/70">
              No alerts recorded
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface AlertItemProps {
  alert: Alert;
  onAck?: () => void;
  onSnooze?: (minutes: number) => void;
  snoozeMenuOpen?: boolean;
  onSnoozeMenuToggle?: () => void;
  variant: 'active' | 'snoozed' | 'acknowledged';
}

function AlertItem({ 
  alert, 
  onAck, 
  onSnooze, 
  snoozeMenuOpen = false, 
  onSnoozeMenuToggle,
  variant 
}: AlertItemProps) {
  const isActive = variant === 'active';
  const isSnoozed = variant === 'snoozed';
  
  return (
    <div className={cn(
      "p-4 rounded-xl border transition-all duration-300 shadow-sm",
      isActive && "bg-red-50 border-red-200 shadow-red-100/50",
      isSnoozed && "bg-amber-50 border-amber-200 shadow-amber-100/50",
      variant === 'acknowledged' && "bg-green-50 border-green-200 opacity-75 shadow-green-100/50"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn(
              'text-xs font-medium px-3 py-1 rounded-full border',
              alert.type === 'PRONE' && 'bg-red-100 text-red-700 border-red-200',
              alert.type === 'CRY' && 'bg-orange-100 text-orange-700 border-orange-200',
              alert.type === 'OVERHEAT' && 'bg-red-100 text-red-700 border-red-200'
            )}>
              {alert.type}
            </Badge>
            <div className="text-sm text-amber-700/70 font-medium">
              {formatTimestamp(alert.timestamp)}
            </div>
          </div>
          <p className="text-sm">{alert.message}</p>
          {alert.durationMs && (
            <div className="text-xs text-amber-600/70 mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(alert.durationMs)}
            </div>
          )}
          {isSnoozed && alert.snoozeUntil && (
            <div className="text-xs text-amber-600 mt-1">
              Snoozed until {formatTimestamp(alert.snoozeUntil)}
            </div>
          )}
        </div>
        
        {isActive && (
          <div className="flex gap-1 relative">
            <Button
              variant="outline"
              size="sm"
              onClick={onAck}
              className="text-green-600 border-green-300 hover:bg-green-50 hover:border-green-400 transition-colors"
            >
              <CheckCircle className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onSnoozeMenuToggle}
              className="text-amber-600 border-amber-300 hover:bg-amber-50 hover:border-amber-400 transition-colors"
            >
              <Snooze className="h-3 w-3" />
            </Button>
            
            {snoozeMenuOpen && onSnooze && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={onSnoozeMenuToggle}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-amber-200 p-2">
                  {SNOOZE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSnooze(option.value);
                        onSnoozeMenuToggle?.();
                      }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-amber-50 rounded-lg transition-colors font-medium"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}