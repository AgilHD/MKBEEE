import React from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { HistoryData, PostureStatus } from '../../shared/types';
import { MockDataGenerator } from '../../infrastructure/repositories/MockDataGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../shared/utils';

interface HistoryChartProps {
  deviceId: string;
  className?: string;
}

export function HistoryChart({ deviceId, className }: HistoryChartProps) {
  const [historyData] = React.useState<HistoryData>(MockDataGenerator.generateHistoryData());
  const [selectedMetric, setSelectedMetric] = React.useState<'posture' | 'cry' | 'temp' | 'humidity'>('posture');
  const [timeRange, setTimeRange] = React.useState<'6h' | '12h' | '24h'>('24h');

  const getFilteredData = () => {
    const now = new Date();
    const hoursBack = timeRange === '6h' ? 6 : timeRange === '12h' ? 12 : 24;
    const cutoff = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    
    return historyData.timeline.filter(point => point.timestamp >= cutoff);
  };

  const filteredData = getFilteredData();

  const getPostureColor = (posture: PostureStatus) => {
    switch (posture) {
      case 'Supine': return 'bg-green-500';
      case 'Prone': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getCryColor = (level: number) => {
    if (level === 0) return 'bg-green-500';
    if (level === 1) return 'bg-yellow-500';
    if (level === 2) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTempColor = (temp: number) => {
    if (temp < 20) return 'bg-blue-500';
    if (temp > 26) return 'bg-red-500';
    return 'bg-green-500';
  };

  const getHumidityColor = (humidity: number) => {
    if (humidity > 70) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  const calculateStats = () => {
    if (filteredData.length === 0) return null;

    const proneTime = filteredData.filter(d => d.posture === 'Prone').length * 10; // 10 min intervals
    const cryEvents = filteredData.filter(d => d.cry > 1).length;
    const avgTemp = filteredData.reduce((sum, d) => sum + d.tempC, 0) / filteredData.length;
    const avgHumidity = filteredData.reduce((sum, d) => sum + d.rh, 0) / filteredData.length;

    return {
      proneTime,
      cryEvents,
      avgTemp: avgTemp.toFixed(1),
      avgHumidity: Math.round(avgHumidity),
    };
  };

  const stats = calculateStats();

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const renderChart = () => {
    const maxPoints = 72; // Show max 72 points for readability
    const step = Math.max(1, Math.floor(filteredData.length / maxPoints));
    const displayData = filteredData.filter((_, index) => index % step === 0);

    return (
      <div className="space-y-4">
        {/* Chart */}
        <div className="h-80 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 overflow-x-auto shadow-inner">
          <div className="flex items-end gap-1 h-full min-w-max relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
              {selectedMetric === 'posture' && (
                <>
                  <span>Prone</span>
                  <span>Supine</span>
                  <span>Unknown</span>
                </>
              )}
              {selectedMetric === 'cry' && (
                <>
                  <span>3</span>
                  <span>2</span>
                  <span>1</span>
                  <span>0</span>
                </>
              )}
              {selectedMetric === 'temp' && (
                <>
                  <span>30°C</span>
                  <span>25°C</span>
                  <span>20°C</span>
                  <span>15°C</span>
                </>
              )}
              {selectedMetric === 'humidity' && (
                <>
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                </>
              )}
            </div>
            
            {/* Chart bars */}
            <div className="flex items-end gap-1 h-full ml-12 flex-1">
            {displayData.map((point, index) => {
              let height = '20%';
              let color = 'bg-gray-400';

              switch (selectedMetric) {
                case 'posture':
                  height = point.posture === 'Prone' ? '100%' : point.posture === 'Supine' ? '60%' : '30%';
                  color = getPostureColor(point.posture);
                  break;
                case 'cry':
                  height = `${Math.max(10, (point.cry / 3) * 100)}%`;
                  color = getCryColor(point.cry);
                  break;
                case 'temp':
                  height = `${Math.max(10, ((point.tempC - 15) / 15) * 100)}%`;
                  color = getTempColor(point.tempC);
                  break;
                case 'humidity':
                  height = `${Math.max(10, (point.rh / 100) * 100)}%`;
                  color = getHumidityColor(point.rh);
                  break;
              }

              return (
                <div
                  key={index}
                  className="flex flex-col items-center group relative"
                  style={{ minWidth: '12px' }}
                >
                  <div
                    className={cn("w-3 rounded-t-lg transition-all duration-200 group-hover:w-4 shadow-sm", color)}
                    style={{ height }}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-10 shadow-lg">
                    <div>{formatTime(point.timestamp)}</div>
                    {selectedMetric === 'posture' && <div>Position: {point.posture}</div>}
                    {selectedMetric === 'cry' && <div>Cry Level: {point.cry}</div>}
                    {selectedMetric === 'temp' && <div>Temp: {point.tempC.toFixed(1)}°C</div>}
                    {selectedMetric === 'humidity' && <div>Humidity: {Math.round(point.rh)}%</div>}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>

        {/* Time Labels */}
        <div className="flex justify-between text-xs text-muted-foreground px-4">
          <span>{formatTime(displayData[0]?.timestamp || new Date())}</span>
          <span>{formatTime(displayData[Math.floor(displayData.length / 2)]?.timestamp || new Date())}</span>
          <span>{formatTime(displayData[displayData.length - 1]?.timestamp || new Date())}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.proneTime}m</div>
              <div className="text-sm text-muted-foreground">Prone Time</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.cryEvents}</div>
              <div className="text-sm text-muted-foreground">Cry Events</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.avgTemp}°C</div>
              <div className="text-sm text-muted-foreground">Avg Temp</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-600">{stats.avgHumidity}%</div>
              <div className="text-sm text-muted-foreground">Avg Humidity</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              24-Hour History
            </CardTitle>
            <div className="flex gap-2">
              {(['6h', '12h', '24h'] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Metric Selector */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'posture', label: 'Sleep Position', icon: '🛏️' },
              { key: 'cry', label: 'Cry Level', icon: '🔊' },
              { key: 'temp', label: 'Temperature', icon: '🌡️' },
              { key: 'humidity', label: 'Humidity', icon: '💧' },
            ].map((metric) => (
              <Button
                key={metric.key}
                variant={selectedMetric === metric.key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMetric(metric.key as any)}
                className="flex items-center gap-2"
              >
                <span>{metric.icon}</span>
                {metric.label}
              </Button>
            ))}
          </div>

          {/* Chart */}
          {renderChart()}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            {selectedMetric === 'posture' && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Supine (Safe)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Prone (Alert)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded"></div>
                  <span>Unknown</span>
                </div>
              </>
            )}
            {selectedMetric === 'cry' && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Quiet (0)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span>Fussing (1)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span>Crying (2)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Intense (3)</span>
                </div>
              </>
            )}
            {selectedMetric === 'temp' && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Cool (&lt;20°C)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Optimal (20-26°C)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Warm (&gt;26°C)</span>
                </div>
              </>
            )}
            {selectedMetric === 'humidity' && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Normal (&lt;70%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span>High (&gt;70%)</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}