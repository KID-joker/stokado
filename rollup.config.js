import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import alias from '@rollup/plugin-alias'
import html from '@rollup/plugin-html'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import serve from 'rollup-plugin-serve'
import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import template from './playground/template.js'

const pkg = JSON.parse(readFileSync('./package.json', { encoding: 'utf8' }))

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const configs = []

const srcDir = path.resolve(__dirname, 'src')
const input = path.resolve(__dirname, 'src/index.ts')
const pkgName = pkg.name
const output = [{
  file: `${process.env.BUILD === 'prod' ? 'dist' : 'playground'}/${pkgName}.js`,
  format: 'iife',
  name: pkgName,
  extend: true,
}]
const pluginEsbuild = process.env.BUILD === 'prod' ? esbuild({ drop: ['console'] }) : esbuild()
const pluginAlias = alias({ entries: [{ find: '@', replacement: srcDir }] })
const plugins = [pluginEsbuild, typescript({ declaration: false }), pluginAlias, nodeResolve({ browser: true })]

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
      dts(),
      pluginAlias,
    ],
  })
}

if (process.env.BUILD !== 'prod') {
  plugins.push(html({
    title: pkgName,
    template,
  }))
}

if (process.env.BUILD === 'dev')
  plugins.push(serve('playground'))

configs.push({
  input,
  output,
  plugins,
})

export default configs
