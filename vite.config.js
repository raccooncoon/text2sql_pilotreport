import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/text2sql_pilotreport/',
  build: {
    outDir: 'docs',
  },
})
