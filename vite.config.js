import vue from '@vitejs/plugin-vue'
import path from 'path'

process.env.VITE_APP_VERSION = require('./package.json')?.version
process.env.VITE_APP_TITLE = require('./package.json')?.name

export default {
  plugins: [
    vue()
  ],
  server: {
    port: 8080
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}
