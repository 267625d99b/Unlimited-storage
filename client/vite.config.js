import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isElectron = process.env.ELECTRON === 'true';

export default defineConfig({
  plugins: [react()],
  base: isElectron ? './' : '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['react-icons']
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/share': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
})
