import typescript from '@rollup/plugin-typescript';
import html from '@rollup/plugin-html';
import path from 'path';

export default [{
  input: path.resolve(__dirname, 'src/index.ts'),
  output: {
    dir: "playground",
    format: "iife",
    name: 'proxyWebStorage'
  },
  plugins: [
    typescript(),
    html()
  ]
}];