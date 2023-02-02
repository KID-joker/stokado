import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from "rollup-plugin-dts";
import path from 'path';

export default [{
  input: path.resolve(__dirname, 'src/index.ts'),
  output: {
    file: 'dist/proxy-web-storage.js',
    format: 'umd',
    name: 'proxyWebStorage'
  },
  plugins: [
    typescript()
  ]
}, {
  input: path.resolve(__dirname, 'src/index.ts'),
  output: {
    file: 'dist/proxy-web-storage.min.js',
    format: 'umd',
    name: 'proxyWebStorage'
  },
  plugins: [
    typescript(),
    terser({
      compress: {
        drop_console: true
      }
    })
  ]
}, {
  input: path.resolve(__dirname, 'src/index.ts'),
  output: {
    file: "dist/proxy-web-storage.d.ts",
    format: "es"
  },
  plugins: [
    dts()
  ]
}];