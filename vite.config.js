import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime']
  },
  server: {
    allowedHosts: ['prayerapp-admin.wahaj.site', '192.168.18.7'],
    strictPort: false,
    hmr: {
      clientPort: 443,
      protocol: 'wss'
    }
  }
})