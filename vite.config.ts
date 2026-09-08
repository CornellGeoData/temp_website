import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // dev: /api/aqi comes from a locally running `node server.mjs`
  server: { proxy: { '/api': 'http://localhost:4173' } },
})
