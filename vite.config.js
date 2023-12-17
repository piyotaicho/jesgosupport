import vue from '@vitejs/plugin-vue'
import path from 'path'

process.env.VITE_APP_VERSION = require('./package.json')?.version
process.env.VITE_APP_TITLE = require('./package.json')?.name

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
