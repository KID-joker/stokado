import { expect, test } from '@playwright/test'
import './global.d.ts'

test.describe('disposable', () => {
  test('setDisposable', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local } = window.stokado
      local.test = 'hello stokado'
      local.setDisposable('test')
    })

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe('hello stokado')

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe(undefined)
  })
})
