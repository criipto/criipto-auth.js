const path = require('path');
const base = require('./webpack.config.base');

module.exports = {
  ...base,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'criipto-auth.js',
    library: {
      name: 'CriiptoAuth',
      type: 'umd',
      export: 'default'
    }
  },
};
