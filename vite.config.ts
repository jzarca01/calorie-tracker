import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Calorie Tracker',
        short_name: 'CalorieTracker',
        description: 'Application de suivi des calories quotidiennes avec scan de codes-barres',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'openfoodfacts-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/off-api': {
        target: 'https://world.openfoodfacts.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/off-api/, ''),
        headers: {
          'User-Agent': 'CalorieTracker/1.0 (https://github.com/calorie-tracker)',
        },
      },
    },
  },
})
