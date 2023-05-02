import { expect, test } from '@playwright/test'
import type { StorageLike } from '@/types'

declare global {
  interface Window {
    proxyWebStorage: {
      local: StorageLike
      session: StorageLike
    }
  }
}

async function delay(ms?: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

test.describe('setItem', async () => {
  test('expired', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.setItem('test', 'hello proxy-web-storage', {
        expires: Date.now() + 1000,
      })
      return local.test
    })).toBe('hello proxy-web-storage')

    await delay(500)

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe('hello proxy-web-storage')

    await delay(500)

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe(undefined)
  })
})
