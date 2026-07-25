import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During `vite dev`, API calls to /api are proxied to the Node server so the
// frontend and backend share an origin (no CORS). In production the Node
// server serves the built files and the API itself, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow local development via production-like hostnames when needed.
    allowedHosts: ['localhost', '127.0.0.1', 'oxongroup.co.uk', 'www.oxongroup.co.uk', 'fete.oxongroup.co.uk'],
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
