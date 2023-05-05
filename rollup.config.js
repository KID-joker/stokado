import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tsConfigPaths from 'rollup-plugin-tsconfig-paths'
import html from '@rollup/plugin-html'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'

const pkg = JSON.parse(readFileSync('./package.json', { encoding: 'utf8' }))

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const configs = []

const input = path.resolve(__dirname, 'src/index.ts')
const pkgName = pkg.name
const output = [{
  file: `${process.env.BUILD === 'test' ? 'playground' : 'dist'}/${pkgName}.js`,
  format: 'iife',
  name: pkgName,
  extend: true,
}]
const pluginEsbuild = esbuild({ drop: ['console'] })
const pluginPaths = tsConfigPaths()
const pluginDts = dts()
const pluginHtml = html()
const plugins = [pluginEsbuild, pluginPaths]

if (process.env.BUILD === 'prod') {
  output.push({
    file: `dist/${pkgName}.mjs`,
    format: 'es',
  }, {
    file: `dist/${pkgName}.cjs`,
    format: 'cjs',
  }, {
    file: `dist/${pkgName}.min.js`,
    format: 'iife',
    name: pkgName,
    extend: true,
    plugins: [
      esbuild({
        minify: true,
      }),
    ],
  })

  configs.push({
    input,
    output: {
      file: `dist/${pkgName}.d.ts`,
      format: 'es',
    },
    plugins: [
      pluginDts,
    ],
  })
}

if (process.env.BUILD === 'test')
  plugins.push(pluginHtml)

configs.push({
  input,
  output,
  plugins,
})

export default configs
