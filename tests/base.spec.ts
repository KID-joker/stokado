import { expect, test } from '@playwright/test'
import { decode, encode } from '@/proxy/transform'
import type { StorageLike } from '@/types'

declare global {
  interface Window {
    proxyWebStorage: {
      local: StorageLike
      session: StorageLike
    }
  }
}

test.describe('basic usage', () => {
  test('transform', async ({ page }) => {
    await page.goto('/')

    const proxyStorage = await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 'hello proxy-web-storage'
      return localStorage.test
    })
    expect(proxyStorage).toBe(encode('hello proxy-web-storage'))
    expect(decode(proxyStorage)).toBe('hello proxy-web-storage')
  })

  test('set, read and delete', async ({ page }) => {
    await page.goto('/')

    // set
    await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 'hello proxy-web-storage'
    })

    // read
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe('hello proxy-web-storage')

    // delete
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      delete local.test
      return local.test
    })).toBe(undefined)
  })

  test('localStorage methods', async ({ page }) => {
    await page.goto('/')

    // key() setItem()
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 'hello localStorage'
      local.setItem('test', 'hello proxy-web-storage')
      local.setItem('foo', 'bar')
      return local.key(0)
    })).toBe('foo')

    // getItem()
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.getItem('test')
    })).toBe('hello proxy-web-storage')

    // length
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.length
    })).toBe(2)

    // removeItem()
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.removeItem('test')
      return local.test
    })).toBe(undefined)

    // clear()
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.clear()
      return local.length
    })).toEqual(0)
  })
})
