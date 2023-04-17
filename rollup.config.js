import path from 'node:path'
import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import dts from 'rollup-plugin-dts'
import { getDirname } from './shared-utils'

const input = path.resolve(getDirname(import.meta.url), 'src/index.ts')

export default [{
  input,
  output: {
    file: 'dist/proxy-web-storage.js',
    format: 'umd',
    name: 'proxyWebStorage',
  },
  plugins: [
    typescript(),
    nodeResolve(),
  ],
}, {
  input,
  output: {
    file: 'dist/proxy-web-storage.min.js',
    format: 'umd',
    name: 'proxyWebStorage',
  },
  plugins: [
    typescript(),
    nodeResolve(),
    terser({
      compress: {
        drop_console: true,
      },
    }),
  ],
}, {
  input,
  output: {
    file: 'dist/proxy-web-storage.d.ts',
    format: 'es',
  },
  plugins: [
    dts(),
  ],
}]
