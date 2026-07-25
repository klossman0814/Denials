import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5404,
    host: '0.0.0.0',
    proxy: { '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:3003', changeOrigin: true } },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
  },
});
