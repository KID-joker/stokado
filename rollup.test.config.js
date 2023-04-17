import typescript from '@rollup/plugin-typescript'
import html from '@rollup/plugin-html'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default [{
  input: 'src/index.ts',
  output: {
    dir: 'playground',
    format: 'iife',
    name: 'proxyWebStorage',
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript(),
    html(),
  ],
}]
