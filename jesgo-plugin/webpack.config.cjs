const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'development',
  devtool: false,
  entry: {
    'jesgo-supporttool-runtime': './jesgo-plugin/src/jesgo-support-runtime.ts',
    'jesgo-supporttool-runtime-for-singlecase': './jesgo-plugin/src/jesgo-support-runtime-for-single.ts',
    'GOCCcheck-single': './jesgo-plugin/src/GOCCcheck.ts',
    'GOEMcheck-single': './jesgo-plugin/src/GOEMcheck.ts',
    'GOOVcheck-single': './jesgo-plugin/src/GOOVcheck.ts',
    'GOTDcheck-single': './jesgo-plugin/src/GOTDcheck.ts',
    'GOUAcheck-single': './jesgo-plugin/src/GOUAcheck.ts',
    'GOUScheck-single': './jesgo-plugin/src/GOUScheck.ts',
    'GOVACcheck-single': './jesgo-plugin/src/GOVACcheck.ts',
    'GOVUCcheck-single': './jesgo-plugin/src/GOVUCcheck.ts',
    // 単純書き出しプラグイン
    'jesgo-exporter': './jesgo-plugin/src/jesgo-exporter.ts',
    'jesgo-single-exporter': './jesgo-plugin/src/jesgo-exporter-single.ts',
    // joed書き出しプラグイン
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
  plugins: [
    new webpack.DefinePlugin({
      __sourceFileName: (pathdata) => JSON.stringify(path.basename(pathdata))
    })
  ],
  experiments: {
    outputModule: true
  },
  performance: {
    maxAssetSize: 1000000, // 500KB
    maxEntrypointSize: 2000000, // 1MB
  },
  output: {
    library: {
      type: 'module'
    },
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  }
}
