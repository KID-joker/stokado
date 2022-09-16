import typescript2 from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

export default {
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
};