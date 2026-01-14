import React from 'react'
import { SensorReading } from '../../shared/types'
import { getEspLcdClient, EspLcdSensorData } from '../../infrastructure/esp/EspLcdClient'

export interface SensorServiceState {
  reading: SensorReading | null
  isLoading: boolean
  error: string | null
  lastUpdated: number
}

const initialState: SensorServiceState = {
  reading: null,
  isLoading: false,
  error: null,
  lastUpdated: 0,
}

/**
 * Hook to fetch sensor data from ESP LCD
 * Polls the ESP LCD device for temperature and humidity data
 */
export function useEspLcdSensors(options: {
  pollIntervalMs?: number
  enabled?: boolean
  thresholds?: { tempC: number; rh: number }
} = {}) {
  const { pollIntervalMs = 2000, enabled = true, thresholds = { tempC: 26, rh: 80 } } = options

  const [state, setState] = React.useState<SensorServiceState>(initialState)
  const clientRef = React.useRef(getEspLcdClient())
  const intervalRef = React.useRef<number | null>(null)
  const mountedRef = React.useRef(true)

  const fetchSensorData = React.useCallback(async () => {
    if (!enabled || !mountedRef.current) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const data = await clientRef.current.getSensorData()

      if (!mountedRef.current) return

      if (data) {
        const reading: SensorReading = {
          tempC: data.tempC,
          rh: data.rh,
          timestamp: new Date(data.timestamp || Date.now()),
          isSafe: data.tempC < thresholds.tempC && data.rh < thresholds.rh,
        }

        setState({
          reading,
          isLoading: false,
          error: null,
          lastUpdated: Date.now(),
        })
      } else {
        // No data available (endpoint not implemented or ESP not responding)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: null, // Don't show error if endpoint not implemented
        }))
      }
    } catch (error: any) {
      if (!mountedRef.current) return

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error?.message || 'Failed to fetch sensor data',
      }))
    }
  }, [enabled, thresholds.tempC, thresholds.rh])

  // Start polling
  React.useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Fetch immediately
    fetchSensorData()

    // Then poll at interval
    intervalRef.current = window.setInterval(() => {
      fetchSensorData()
    }, pollIntervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, pollIntervalMs, fetchSensorData])

  // Cleanup on unmount
  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  const refresh = React.useCallback(() => {
    fetchSensorData()
  }, [fetchSensorData])

  return {
    ...state,
    refresh,
  }
}

/**
 * Convert ESP LCD sensor data to SensorReading format
 */
export function convertEspLcdDataToReading(
  data: EspLcdSensorData,
  thresholds: { tempC: number; rh: number }
): SensorReading {
  return {
    tempC: data.tempC,
    rh: data.rh,
    timestamp: new Date(data.timestamp || Date.now()),
    isSafe: data.tempC < thresholds.tempC && data.rh < thresholds.rh,
  }
}
