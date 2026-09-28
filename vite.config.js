import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const STATIC = !!process.env.VITE_STATIC;

export default defineConfig({
  plugins: [react()],
  // Static build for GitHub Pages is served from /<repo>/ → relative asset paths
  base: STATIC ? './' : '/',
  build: { outDir: STATIC ? 'site' : 'webapp', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
});
