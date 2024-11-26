import vue from '@vitejs/plugin-vue'
import path from 'path'

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
    vue()
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
