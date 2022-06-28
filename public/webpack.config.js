const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: [
    './public/src/index.js',
    './public/src/styles.css',
    './public/src/libs/ui-bootstrap-custom-2.5.0-csp.css',
  ],
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
    hot: true,
    port: 8080,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {from: 'public/src/index.html'},
        {from: 'public/src/troves.html'},
        {from: 'public/src/libs', to: 'libs'}
      ]
    }),
  ],
  resolve: {
    extensions: ['.ts', ".js", ".css"],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/'
  },
};