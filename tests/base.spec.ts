import { expect, test } from '@playwright/test'
import { decode, encode } from '@/proxy/transform'
import type { StorageLike } from '@/types'

declare global {
  interface Window {
    proxyWebStorage: StorageLike
  }
}

test('proxy-web-storage', async ({ page }) => {
  await page.goto('/')
  const localTest = await page.evaluate(() => {
    const { local } = window.proxyWebStorage
    local.test = 'hello proxy-web-storage'
    return localStorage.test
  })

  expect(localTest).toBe(encode('hello proxy-web-storage'))
  expect(decode(localTest)).toBe('hello proxy-web-storage')
})
