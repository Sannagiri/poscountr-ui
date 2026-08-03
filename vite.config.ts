import { fileURLToPath, URL } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import react from '@vitejs/plugin-react';

// Path alias (@/*) must mirror tsconfig.app.json so imports resolve
// identically for the TypeScript compiler, Vite, and Vitest.
export default defineConfig({
  plugins: [
    react(),
    // Precaches the built app shell (JS/CSS/HTML) so the SPA itself opens
    // with zero network after a first online visit — offline mode's own
    // data handling (src/offline/) stays explicit/app-managed, so this
    // plugin caches no API responses, only the static build output.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'POSCountr',
        short_name: 'POSCountr',
        display: 'standalone',
        start_url: '/',
      },
      workbox: {
        // Default globPatterns already cover js/css/html; navigateFallback
        // lets a reload on any client-routed path resolve to the shell
        // while offline instead of a 404.
        navigateFallback: '/index.html',
        // Workbox's own default cap (2 MiB) is smaller than this app's own
        // main chunk now — left at the default, the build fails outright
        // (workbox refuses to precache the file, then errors instead of
        // just skipping it). Raised with headroom above the current ~2.2MB
        // bundle so ordinary feature growth doesn't retrip this the next
        // time someone builds for production.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.PORT) || 3200,
    host: true,
  },
  preview: {
    port: Number(process.env.PORT) || 3200,
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
