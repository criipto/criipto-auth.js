const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

const commonConfig = {
  mode: 'production',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader'
      }
    ]
  },
  resolve: {
    extensions: [ '.ts', '.tsx', '.js' ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "src/index.css", to: "index.css" }
      ]
    })
  ]
}

module.exports = [
  {
    ...commonConfig,
    experiments: {
      outputModule: true
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'criipto-auth.esm.js',
      library: {
        type: 'module'
      }
    }
  },
  {
    ...commonConfig,
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'criipto-auth.cjs.js',
      library: {
        type: 'commonjs'
      }
    }
  },
  {
    ...commonConfig,
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'criipto-auth.umd.js',
      library: {
        name: 'CriiptoAuth',
        type: 'umd',
        export: 'default'
      }
    }
  }
];