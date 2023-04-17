import { expect, test } from '@playwright/test'
import { serve } from 'serve-then'
import { decode, encode } from '../src/proxy/transform'
import type { StorageLike } from '../src/types'

declare global {
  interface Window {
    proxyWebStorage: StorageLike
  }
}

let serverURL: string

test.beforeAll(async () => {
  serverURL = await serve({
    root: '/playground',
  })
})

test('proxy-web-storage', async ({ page }) => {
  await page.goto(serverURL)
  const localTest = await page.evaluate(() => {
    const { local } = window.proxyWebStorage
    local.test = 'hello proxy-web-storage'
    return localStorage.test
  })

  expect(localTest).toBe(encode('hello proxy-web-storage'))
  expect(decode(localTest)).toBe('hello proxy-web-storage')
})
