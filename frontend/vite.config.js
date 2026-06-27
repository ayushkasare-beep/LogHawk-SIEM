import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ====================================
// LogHawk Frontend – Vite Configuration
// ====================================
// Configures React plugin and Tailwind CSS for the LogHawk dashboard.
// Proxy API requests to the backend server during development.

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
