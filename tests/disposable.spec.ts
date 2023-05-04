import { expect, test } from '@playwright/test'
import './global.d.ts'

test.describe('disposable', () => {
  test('setDisposable', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 'hello proxy-web-storage'
      local.setDisposable('test')
    })

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe('hello proxy-web-storage')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe(undefined)
  })
})
