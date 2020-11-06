const path = require("path");

module.exports = {
  mode: "production",
  entry: "./src/astronomy-api-widgets.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "astronomy-api-widgets.js",
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: "ts-loader",
      },
    ],
  },
  optimization: {
    minimize: true,
  },
};
