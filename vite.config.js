import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_PORT = process.env.PORT || 3001

export default defineConfig({
  plugins: [react()],
  // Excalidraw checks this flag; without it the whiteboard fails in dev mode.
  define: {
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    host: true,
    // In development the API runs separately; forward its routes.
    proxy: {
      '/api': { target: `http://localhost:${API_PORT}` },
      '/uploads': { target: `http://localhost:${API_PORT}` },
    },
  },
  build: {
    chunkSizeWarningLimit: 4000,
  },
})
