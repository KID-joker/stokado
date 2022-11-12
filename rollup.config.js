import typescript2 from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import dts from "rollup-plugin-dts";
import path from 'path';

export default [{
  input: 'src/index.ts',
  output: {
    file: 'dist/proxy-web-storage.js',
    format: 'umd',
    name: 'proxyWebStorage'
  },
  plugins: [
    typescript2(),
    terser()
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