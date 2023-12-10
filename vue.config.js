const { defineConfig } = require('@vue/cli-service')
process.env.VUE_APP_VERSION = require('./package.json')?.version

module.exports = defineConfig({
  publicPath: './',
  transpileDependencies: true,
  devServer: {
    client: {
      overlay: {
        runtimeErrors: (error) => {
          const ignoreErrors = [
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications.'
          ]
          if (ignoreErrors.includes(error.message)) {
            return false
          }
          return true
        }
      }
    }
  }
})
