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

    const localTest = await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 'hello proxy-web-storage'
      return localStorage.test
    })
    expect(localTest).toBe(encode('hello proxy-web-storage'))
    expect(decode(localTest)).toBe('hello proxy-web-storage')
  })

  test('set, read and delete', async ({ page }) => {
    await page.goto('/')

    // set
    await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 'hello proxy-web-storage'
    })

    // read
    const localRead = await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })
    expect(localRead).toBe('hello proxy-web-storage')

    // delete
    const localDelete = await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      delete local.test
      return local.test
    })
    expect(localDelete).toBe(undefined)
  })

  test('localStorage methods', async ({ page }) => {
    await page.goto('/')

    // key() setItem()
    const localKey = await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 'hello localStorage'
      local.setItem('test', 'hello proxy-web-storage')
      local.setItem('foo', 'bar')
      return local.key(0)
    })
    expect(localKey).toBe('foo')

    // getItem()
    const localGetItem = await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.getItem('test')
    })
    expect(localGetItem).toBe('hello proxy-web-storage')

    // length
    const localLength = await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.length
    })
    expect(localLength).toBe(2)

    // removeItem()
    const localRemoveItem = await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.removeItem('test')
      return local.test
    })
    expect(localRemoveItem).toBe(undefined)

    // clear()
    const localClear = await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.clear()
      return local.length
    })
    expect(localClear).toEqual(0)
  })
})
