import { expect, test } from '@playwright/test'
import { decode, encode } from '@/proxy/transform'
import './global.d.ts'

test.describe('basic usage', () => {
  test('transform', async ({ page }) => {
    await page.goto('/')

    const proxyStorage = await page.evaluate(() => {
      const { local } = window.stokado
      local.test = 'hello stokado'
      return localStorage.test
    })
    expect(proxyStorage).toBe(encode({ data: 'hello stokado', options: {} }))
    expect(decode({ data: proxyStorage })).toBe('hello stokado')
  })

  test('set, read and delete', async ({ page }) => {
    await page.goto('/')

    // set
    await page.evaluate(() => {
      const { local } = window.stokado
      local.test = 'hello stokado'
    })

    // read
    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe('hello stokado')

    // delete
    expect(await page.evaluate(() => {
      const { local } = window.stokado
      delete local.test
      return local.test
    })).toBeUndefined()
  })

  test('localStorage methods', async ({ page }) => {
    await page.goto('/')

    // key() setItem()
    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.test = 'hello localStorage'
      local.setItem('test', 'hello stokado')
      local.setItem('foo', 'bar')
      return local.key(0)
    })).toBe('foo')

    // getItem()
    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.getItem('test')
    })).toBe('hello stokado')

    // length
    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.length
    })).toBe(2)

    // removeItem()
    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.removeItem('test')
      return local.test
    })).toBeUndefined()

    // clear()
    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.clear()
      return local.length
    })).toEqual(0)
  })
})
