import { getEspLcdHttpUrl, getRuntimeEspLcdHost, setRuntimeEspLcdHost } from '../../config/audio'

export type CryStatus = 'Menangis' | 'TidakMenangis'

export interface EspLcdSensorData {
  tempC: number
  rh: number
  timestamp: number
}

export class EspLcdClient {
  private baseUrl: string
  private host: string

  constructor(host?: string) {
    this.host = host || getRuntimeEspLcdHost()
    this.baseUrl = getEspLcdHttpUrl(this.host)
  }

  /**
   * Send cry status to ESP LCD
   * @param status - 'Menangis' or 'TidakMenangis'
   * @returns Promise that resolves when the request completes
   */
  async sendCryStatus(status: CryStatus): Promise<void> {
    try {
      const url = `${this.baseUrl}/cry?status=${encodeURIComponent(status)}`
      
      // Create abort controller for timeout (fallback for browsers that don't support AbortSignal.timeout)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(url, {
        method: 'GET',
        // Do not set Content-Type on GET to avoid CORS preflight that ESP may not handle
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`ESP LCD responded with status ${response.status}`)
      }

      const text = await response.text()
      if (import.meta.env.DEV) {
        console.log(`[ESP LCD] Cry status sent: ${status}`, { response: text })
      }
    } catch (error: any) {
      // Don't throw - just log the error so it doesn't break the app
      if (error?.name === 'AbortError') {
        console.warn(`[ESP LCD] Cry status request timed out: ${status}`)
      } else {
        console.warn(`[ESP LCD] Failed to send cry status: ${status}`, error?.message || error)
      }
    }
  }

  /**
   * Get sensor data from ESP LCD
   * Note: This endpoint needs to be added to the ESP LCD code
   * @returns Promise with sensor data
   */
  async getSensorData(): Promise<EspLcdSensorData | null> {
    try {
      const url = `${this.baseUrl}/sensors`
      
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(url, {
        method: 'GET',
        // Do not set Content-Type on GET to avoid CORS preflight that ESP may not handle
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 404) {
          // Endpoint not yet implemented on ESP
          return null
        }
        throw new Error(`ESP LCD responded with status ${response.status}`)
      }

      const data = await response.json()
      return {
        tempC: Number(data.tempC ?? data.suhu ?? 0),
        rh: Number(data.rh ?? data.kelembaban ?? 0),
        timestamp: Number(data.timestamp ?? Date.now()),
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn('[ESP LCD] Sensor data request timed out')
      } else if (error?.message?.includes('404') || error?.message?.includes('Failed to fetch')) {
        // Endpoint not implemented yet or network error
        if (import.meta.env.DEV) {
          console.warn('[ESP LCD] Sensor endpoint not available:', error?.message)
        }
        return null
      } else {
        console.warn('[ESP LCD] Failed to get sensor data', error?.message || error)
      }
      return null
    }
  }

  /**
   * Update the ESP LCD host
   */
  setHost(host: string) {
    this.host = host
    setRuntimeEspLcdHost(host)
    this.baseUrl = getEspLcdHttpUrl(host)
  }

  /**
   * Get current ESP LCD host
   */
  getHost(): string {
    return this.host
  }
}

// Singleton instance
let espLcdClientInstance: EspLcdClient | null = null

export function getEspLcdClient(host?: string): EspLcdClient {
  if (!espLcdClientInstance) {
    espLcdClientInstance = new EspLcdClient(host)
  } else if (host) {
    espLcdClientInstance.setHost(host)
  }
  return espLcdClientInstance
}
