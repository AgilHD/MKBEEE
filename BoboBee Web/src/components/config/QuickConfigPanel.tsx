import React from 'react';
import { Settings, Save, RotateCcw, Clock, Thermometer, Droplets, Shield } from 'lucide-react';
import { QuickConfig } from '../../shared/types';
import { MockDataGenerator } from '../../infrastructure/repositories/MockDataGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { cn } from '../../shared/utils';

interface QuickConfigPanelProps {
  deviceId: string;
  className?: string;
}

export function QuickConfigPanel({ deviceId, className }: QuickConfigPanelProps) {
  const [config, setConfig] = React.useState<QuickConfig>(MockDataGenerator.generateQuickConfig());
  const [hasChanges, setHasChanges] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleConfigChange = (key: keyof QuickConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setHasChanges(false);
  };

  const handleReset = () => {
    setConfig(MockDataGenerator.generateQuickConfig());
    setHasChanges(false);
  };

  const formatTime = (time: string) => {
    return time;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Save/Reset Actions */}
      {hasChanges && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <Settings className="h-4 w-4" />
                <span className="font-medium">You have unsaved changes</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Environmental Thresholds */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Environmental Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Temperature Threshold */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Temperature Alert Threshold
              </label>
              <div className="space-y-2">
                <Slider
                  value={[config.tempThreshold]}
                  onValueChange={([value]) => handleConfigChange('tempThreshold', value)}
                  max={35}
                  min={15}
                  step={0.5}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>15°C</span>
                  <span className="font-medium">{config.tempThreshold}°C</span>
                  <span>35°C</span>
                </div>
              </div>
            </div>

            {/* Humidity Threshold */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Droplets className="h-4 w-4" />
                Humidity Alert Threshold
              </label>
              <div className="space-y-2">
                <Slider
                  value={[config.rhThreshold]}
                  onValueChange={([value]) => handleConfigChange('rhThreshold', value)}
                  max={100}
                  min={30}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>30%</span>
                  <span className="font-medium">{config.rhThreshold}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Settings */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Alert Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Smoothing */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                Detection Smoothing (N of M)
              </label>
              <Input
                type="number"
                value={config.smoothingNofM}
                onChange={(e) => handleConfigChange('smoothingNofM', parseInt(e.target.value))}
                min={1}
                max={10}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Require N positive detections out of M samples before alerting
              </p>
            </div>

            {/* Alert Delay */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                Alert Delay (seconds)
              </label>
              <Input
                type="number"
                value={config.delayMs / 1000}
                onChange={(e) => handleConfigChange('delayMs', parseInt(e.target.value) * 1000)}
                min={0}
                max={300}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Wait time before triggering alert
              </p>
            </div>

            {/* Cooldown Period */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                Cooldown Period (minutes)
              </label>
              <Input
                type="number"
                value={config.cooldownMs / 60000}
                onChange={(e) => handleConfigChange('cooldownMs', parseInt(e.target.value) * 60000)}
                min={1}
                max={60}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Minimum time between repeated alerts
              </p>
            </div>

            {/* Auto Response */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Auto Response Enabled
                </label>
                <Switch
                  checked={config.autoResponseEnabled}
                  onCheckedChange={(checked) => handleConfigChange('autoResponseEnabled', checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically play soothing sounds when crying is detected
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium">
                Start Time
              </label>
              <Input
                type="time"
                value={config.quietHoursStart}
                onChange={(e) => handleConfigChange('quietHoursStart', e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">
                End Time
              </label>
              <Input
                type="time"
                value={config.quietHoursEnd}
                onChange={(e) => handleConfigChange('quietHoursEnd', e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>Quiet Hours:</strong> {formatTime(config.quietHoursStart)} - {formatTime(config.quietHoursEnd)}
              <br />
              During these hours, audio alerts will be reduced and automatic responses will be gentler.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current Status */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Configuration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">{config.tempThreshold}°C</div>
              <div className="text-xs text-green-700">Temp Limit</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">{config.rhThreshold}%</div>
              <div className="text-xs text-blue-700">Humidity Limit</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">{config.delayMs / 1000}s</div>
              <div className="text-xs text-purple-700">Alert Delay</div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-600">{config.cooldownMs / 60000}m</div>
              <div className="text-xs text-orange-700">Cooldown</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}