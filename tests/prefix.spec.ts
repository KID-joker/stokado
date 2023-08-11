import { expect, test } from '@playwright/test'
import './global.d.ts'

test.describe('prefix', () => {
  test('setPrefix and Storage.key', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { setPrefix } = window.stokado
      setPrefix('stokado')
    })

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.test = 'hello stokado'
      return local.key(0)
    })).toBe('test')

    expect(await page.evaluate(() => {
      return window.localStorage.key(0)
    })).toBe('stokado:test')
  })
})
