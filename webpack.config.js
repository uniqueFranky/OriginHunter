const path = require('path');

module.exports = {
  entry: './src/views/index.tsx', // TypeScript 入口文件
  output: {
    filename: 'bundle.js',  // 打包后的输出文件
    path: path.resolve(__dirname, 'dist'), // 输出目录
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'], // 解析的文件扩展名
    fallback: {
      "timers": require.resolve("timers-browserify")
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/, // 处理 .tsx 和 .ts 文件
        use: 'ts-loader', // 使用 ts-loader 来处理 TypeScript 文件
        exclude: /node_modules/,
      },
      {
        test: /\.js$/, // 处理 .js 文件
        use: 'babel-loader', // 使用 babel-loader 处理 ES6+ 和 JSX 代码
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'], // 使用 style-loader 和 css-loader
      }
    ]
  },
  mode: 'development', // 或 production
  devtool: 'source-map', // 启用源码映射
};
