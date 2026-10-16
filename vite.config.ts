import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'habit_ctl',
        short_name: 'habit_ctl',
        description: 'Run your habits like services. Local-first, terminal-style habit tracker.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Add Habit',
            short_name: 'Add',
            description: 'Create a new habit',
            url: '/#add-habit',
            icons: [{ src: '/icon-add.png', sizes: '192x192' }]
          },
          {
            name: 'Today',
            short_name: 'Today',
            description: "View today's habits",
            url: '/#today',
            icons: [{ src: '/icon-today.png', sizes: '192x192' }]
          }
        ],
        categories: ['productivity', 'health', 'utilities']
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.appwrite\.io\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'appwrite-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 10
            }
          }
        ]
      }
    })
  ],
  build: { target: 'es2022', minify: 'esbuild', cssCodeSplit: true },
  server: { port: 3000, host: true }
});