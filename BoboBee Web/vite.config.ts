import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  css: {
    postcss: path.resolve(__dirname, './postcss.config.js'),
  },

  server: {
    host: true,     // akses dari device lain di LAN
    port: 5173,
    cors: true,

    // ⬇️ Proxy rules
    proxy: {
      // ---- ESP32-S3 camera ----
      // Map /esp/* -> http://10.98.128.243/*
      '/esp': {
        target: 'http://10.98.128.243',   // GANTI kalau IP ESP berubah
        changeOrigin: true,
        secure: false,
        ws: false,
        // /esp/stream -> /stream
        rewrite: (path) => path.replace(/^\/esp/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[ESP] ->', req.method, req.url)
          })
          proxy.on('error', (err) => {
            console.error('[ESP] proxy error:', err?.message)
          })
        },
      },

      // ---- Teachable Machine (opsional untuk dev) ----
      // Map /teachablemachine/* -> https://teachablemachine.withgoogle.com/*
      '/teachablemachine': {
        target: 'https://teachablemachine.withgoogle.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/teachablemachine/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[TM]  ->', req.method, req.url)
          })
          proxy.on('error', (err) => {
            console.error('[TM] proxy error:', err?.message)
          })
        },
      },
    },
  },

  build: {
    rollupOptions: {
      // biarkan kosong; kamu tidak perlu external di sini
    },
  },
})
