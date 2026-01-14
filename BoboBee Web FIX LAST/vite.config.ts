import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

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

    proxy: {
      // ESP LCD (HTTP) — device #2 (harus di atas /esp agar lebih spesifik diprioritaskan)
      '/esp-lcd': {
        target: 'http://10.70.179.240/',  // GANTI kalau IP ESP LCD berubah
        changeOrigin: true,
        secure: false,
        ws: false,
        rewrite: (path) => path.replace(/^\/esp-lcd/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[ESP-LCD] ->', req.method, req.url)
          })
          proxy.on('error', (err) => {
            console.error('[ESP-LCD] proxy error:', err?.message)
          })
        },
      },

      // ESP Audio/Camera (WebSocket + HTTP) — device #1
      '/esp': {
        target: 'http://10.70.179.243/',   // GANTI kalau IP ESP berubah
        changeOrigin: true,
        secure: false,
        ws: false,
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
