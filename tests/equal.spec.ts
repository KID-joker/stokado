/* eslint-disable no-self-compare */
import { expect, test } from '@playwright/test'
import './global.d.ts'

test.describe('equal object', () => {
  test('Standard built-in objects', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.test = {
        $string: 'hello stokado',
        $number: 0,
        $boolean: true,
        $null: null,
        $undefined: undefined,
      }
      return local.test === local.test
    })).toBe(true)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.test = []
      local.test[0] = 'hello'
      local.test.push('stokado')
      return local.test === local.test
    })).toBe(true)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.test = new Date()
      return local.test === local.test
    })).toBe(true)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.test = new RegExp('ab+c')
      return local.test === local.test
    })).toBe(true)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.test = new URL(location.href)
      return local.test === local.test
    })).toBe(true)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      function foo() {
        return 'hello stokado!'
      }
      local.test = foo
      return local.test === local.test
    })).toBe(true)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.test = new Set(['hello stokado'])
      return local.test === local.test
    })).toBe(true)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.test = new Map([['hello', 'stokado'], ['foo', 'bar']])
      return local.test === local.test
    })).toBe(true)
  })
})
