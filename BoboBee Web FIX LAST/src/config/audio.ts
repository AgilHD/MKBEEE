export const DEFAULT_ESP_HOST = (import.meta as any).env?.VITE_ESP_HOST ?? '10.70.179.240'
export const ESP_WS_PORT = Number((import.meta as any).env?.VITE_ESP_WS_PORT ?? 81)
export const TM_AUDIO_BASE = (import.meta as any).env?.VITE_TM_AUDIO_BASE ?? '/tm-audio-model/'
export const DEFAULT_ESP_LCD_HOST = (import.meta as any).env?.VITE_ESP_LCD_HOST ?? '10.70.179.243'
export const ESP_LCD_HTTP_PORT = Number((import.meta as any).env?.VITE_ESP_LCD_HTTP_PORT ?? 80)

const LS_KEY_HOST = 'bb_esp_host'
const LS_KEY_LCD_HOST = 'bb_esp_lcd_host'

export function getRuntimeEspHost(): string {
  try {
    const v = localStorage.getItem(LS_KEY_HOST)
    return (v && v.trim()) || DEFAULT_ESP_HOST
  } catch {
    return DEFAULT_ESP_HOST
  }
}

export function setRuntimeEspHost(host: string) {
  try {
    localStorage.setItem(LS_KEY_HOST, (host || '').trim())
  } catch {}
}

export function getWsUrlFromHost(host: string): string {
  const raw = (host || DEFAULT_ESP_HOST).replace(/^ws:\/\//, '').replace(/^http[s]?:\/\//, '')
  const slashIdx = raw.indexOf('/')
  const base = slashIdx >= 0 ? raw.slice(0, slashIdx) : raw
  const path = slashIdx >= 0 ? raw.slice(slashIdx) : '/'
  return `ws://${base}:${ESP_WS_PORT}${path.endsWith('/') ? path : path + '/'}`
}

export function getRuntimeEspLcdHost(): string {
  try {
    const v = localStorage.getItem(LS_KEY_LCD_HOST)
    return (v && v.trim()) || DEFAULT_ESP_LCD_HOST
  } catch {
    return DEFAULT_ESP_LCD_HOST
  }
}

export function setRuntimeEspLcdHost(host: string) {
  try {
    localStorage.setItem(LS_KEY_LCD_HOST, (host || '').trim())
  } catch {}
}

export function getEspLcdHttpUrl(host?: string): string {
  // In dev, use Vite proxy path to avoid CORS
  if ((import.meta as any).env?.DEV) {
    return '/esp-lcd'
  }
  const h = (host || getRuntimeEspLcdHost()).replace(/^http[s]?:\/\//, '')
  const slashIdx = h.indexOf('/')
  const base = slashIdx >= 0 ? h.slice(0, slashIdx) : h
  return `http://${base}:${ESP_LCD_HTTP_PORT}`
}


