const path = require('path')

module.exports = {
  mode: 'development',
  devtool: false,
  entry: {
    // 'jesgo-supporttool-runtime': 'jesgo-plugin/src/index.ts',
    // 'error-importer': 'jesgo-plugin/src/error-importer.js',
    'jesgo-exporter': './jesgo-plugin/src/jesgo-exporter.ts',
    // 'jesgo-exporter-original': './jesgo-plugin/src/jesgo-exporter-original.js',
    'export-to-joed': './jesgo-plugin/src/export-to-joed.ts'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'jesgo-plugin/tsconfig.json'
          }
        }
      },
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  modules: 'commonjs',
                  targets: {
                    node: 13
                  }
                }
              ]
            ]

          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.html$/i,
        use: {
          loader: 'html-loader'
        },
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [
      '.js', '.ts'
    ]
  },
  experiments: {
    outputModule: true
  },
  output: {
    library: {
      type: 'module'
    },
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  }
}
