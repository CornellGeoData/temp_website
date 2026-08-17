import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ponytail: allow any host so the temp Railway domain works with `vite preview`
  preview: { allowedHosts: true },
})
