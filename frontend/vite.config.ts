import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/', // Explicitly set base to root
  build: {
    outDir: 'dist',
    sourcemap: false // Keeps your build light for faster Vercel deployment
  },
  server: {
    historyApiFallback: true // Helps with local routing issues
  }
})