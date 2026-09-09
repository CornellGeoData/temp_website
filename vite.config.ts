import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { main: 'index.html', lidar: 'lidar/index.html' } } },
  // Sensor API served locally by npm start.
  server: { proxy: { '/api': 'http://localhost:4173' } },
})
