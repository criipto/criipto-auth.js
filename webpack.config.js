const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  experiments: {
    outputModule: true
  },
  entry: {
    'criipto-auth.esm': {
      import: path.resolve(__dirname, 'src/index.ts'),
      library: {
        type: 'module'
      }
    },
    'criipto-auth.cjs': {
      import: path.resolve(__dirname, 'src/index.ts'),
      library: {
        type: 'commonjs'
      }
    },
    'criipto-auth.umd': {
      import: path.resolve(__dirname, 'src/index.ts'),
      library: {
        type: 'umd'
      }
    }
  },
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
};
