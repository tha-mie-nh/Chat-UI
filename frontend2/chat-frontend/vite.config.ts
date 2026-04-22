import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': `http://${process.env.BACKEND_HOST ?? 'localhost:3001'}`,
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('react-markdown') || id.includes('remark-gfm') ||
              id.includes('rehype-highlight') || id.includes('highlight.js')) {
            return 'markdown';
          }
          if (id.includes('react-dom') || id.includes('react/')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
})
