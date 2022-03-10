const path = require('path');
const base = require('./webpack.config.base');

module.exports = {
  ...base,
  experiments: {
    outputModule: true
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'criipto-auth.cjs',
    library: {
      type: 'commonjs'
    }
  },
};
