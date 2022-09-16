import typescript2 from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/proxyStorage.js',
    format: 'umd',
    name: 'proxyStorage'
  },
  plugins: [
    typescript2(),
    terser()
  ]
};