import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The teammate backend (Next.js) runs on :3000. Proxying /api keeps the browser on one origin,
// so no CORS setup is needed in either app.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
