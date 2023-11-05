const path = require('path')

module.exports = {
  mode: 'development',
  devtool: false,
  entry: {
    'jesgo-supporttool-runtime': './jesgo-plugin/src/jesgo-support-runtime.ts',
    'jesgo-exporter': './jesgo-plugin/src/jesgo-exporter.ts',
    'jesgo-single-exporter': './jesgo-plugin/src/jesgo-exporter-single.ts',
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
        test: /\.json$/i,
        type: 'javascript/auto',
        use: {
          loader: 'json-loader',
          options: {
            json: 'string'
          }
          // ,
          // options: {
          //   esModule: false
          // }
        },
        exclude: /node_modules/
      },
      {
        test: /\.html$/i,
        use: {
          loader: 'raw-loader',
          options: {
            esModule: false
          }
        },
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [
      '.js', '.ts', '.json', '.html'
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
