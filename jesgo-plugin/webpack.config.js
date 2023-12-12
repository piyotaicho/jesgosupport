const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'development',
  devtool: false,
  entry: {
    'runtime-all': './jesgo-plugin/src/jesgo-support-runtime.ts',
    'runtime-each': './jesgo-plugin/src/jesgo-support-runtime-for-single.ts',
    'export-all': './jesgo-plugin/src/jesgo-exporter.ts',
    'export-each': './jesgo-plugin/src/jesgo-exporter-single.ts',
    'checkCC2023-all': './jesgo-plugin/src/check-CC-2023.ts',
    'checkCC2023-each': './jesgo-plugin/src/check-CC-2023-single.ts',
    'checkEM2023-all': './jesgo-plugin/src/check-EM-2023.ts',
    'checkEM2023-each': './jesgo-plugin/src/check-EM-2023-single.ts',
    'checkOV2023-all': './jesgo-plugin/src/check-OV-2023.ts',
    'checkOV2023-each': './jesgo-plugin/src/check-OV-2023-single.ts',
    'export-to-joed': './jesgo-plugin/src/export-to-joed.ts',
    'import-go-ids': './jesgo-plugin/src/import-jsog-ids.ts'
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
  plugins: [
    new webpack.DefinePlugin({
      __sourceFileName: (pathdata) => JSON.stringify(path.basename(pathdata))
    })
  ],
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
