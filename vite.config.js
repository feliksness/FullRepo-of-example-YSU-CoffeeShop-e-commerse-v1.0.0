// Coffee Lab — Vite config · Built by FeliksKhangeldyan
// base: './' makes the build work on any GitHub Pages path (user or project site).
// Routing uses HashRouter, so no 404.html redirect trick is needed.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          map: ['leaflet', 'react-leaflet'],
          charts: ['recharts']
        }
      }
    }
  }
});
