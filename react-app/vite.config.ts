import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    // Dev-only proxy: the SPA calls `/api/v1/...` on its own origin, so the
    // same build works over localhost, the LAN IP, or a tunnel without CORS
    // or a hardcoded API host. Production uses VITE_API_URL from the build.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
