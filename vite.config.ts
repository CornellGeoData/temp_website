import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const viewers = ['lidar', 'hexapod']

export default defineConfig({
  plugins: [react(), {
    name: 'viewer-entry-paths',
    // Keep the public viewer URLs independent of their source directories.
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const match = req.url?.match(/^\/(lidar|hexapod)(?:\/(?:index\.html)?)?(\?.*)?$/)
        if (match) req.url = `/src/viewers/${match[1]}/index.html${match[2] || ''}`
        next()
      })
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const viewer of viewers) {
          const source = `src/viewers/${viewer}/index.html`
          const entry = bundle[source]
          if (entry?.type !== 'asset') continue
          delete bundle[source]
          this.emitFile({ type: 'asset', fileName: `${viewer}/index.html`, source: entry.source })
        }
      },
    },
  }],
  build: { rollupOptions: { input: { main: 'index.html', ...Object.fromEntries(viewers.map(viewer => [viewer, `src/viewers/${viewer}/index.html`])) } } },
  // Sensor API served locally by npm start.
  server: { proxy: { '/api': 'http://localhost:4173' } },
})
