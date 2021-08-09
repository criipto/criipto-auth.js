const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'criipto-auth.js',
    library: {
      name: 'CriiptoAuth',
      type: 'umd',
      export: 'default'
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
        { from: "src/index.css", to: "dist/index.css" }
      ]
    })
  ]
};
