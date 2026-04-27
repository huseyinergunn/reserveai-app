import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../shared') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target:              'http://localhost:3000',
        changeOrigin:        true,
        // Strip the Domain attribute from Set-Cookie headers so the browser
        // stores the cookie for the Vite origin (localhost:5173), not the
        // backend origin (localhost:3000). Without this, the cookie may not
        // be sent back on subsequent proxied requests.
        cookieDomainRewrite: { '*': '' },
      },
    },
  },
  build: {
    target:    'es2020',
    sourcemap: false,
    outDir:    'dist',
  },
});
