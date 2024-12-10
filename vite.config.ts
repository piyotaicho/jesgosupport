import vue from '@vitejs/plugin-vue'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// package.jsonのバージョンなどを取得

// eslint-disable-next-line @typescript-eslint/no-var-requires
process.env.VITE_APP_VERSION = require('./package.json')?.version
// eslint-disable-next-line @typescript-eslint/no-var-requires
process.env.VITE_APP_TITLE = require('./package.json')?.name
// eslint-disable-next-line @typescript-eslint/no-var-requires
process.env.VITE_APP_LICENSE = require('./package.json')?.license

export default {
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'JESGO support tool',
        lang: 'ja',
        display: 'standalone',
        background_color: '#c0c0c0',
        theme_color: '#ff00ff',
        icons: [
          {
            src: 'NewIcon48.png',
            sizes: '48x48',
            type: 'image/png'
          },
          {
            src: 'NewIcon96.png',
            sizes: '96x96',
            type: 'image/png'
          },
          {
            src: 'NewIcon192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'NewIcon512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{css,html,ico,js,png,webmanifest}']
      }
    })
  ],
  server: {
    port: 8080
  },
  build: {
    minify: 'terser',
    terserOptions: {
      ecma: '2016'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}
