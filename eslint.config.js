import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['.DS_Store', '**/.DS_Store/**', 'node_modules', 'dist', 'playground/stokado.js'],
}, {
  rules: {
    'no-new-wrappers': 'off',
    'prefer-regex-literals': 'off',
    'ts/no-unsafe-function-type': 'off',
    'unicorn/new-for-builtins': 'off',
  },
})
