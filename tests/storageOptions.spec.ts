import { expect, test } from '@playwright/test'
import './global.d.ts'

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

  test('expired after disposable', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.setItem('test', 'hello proxy-web-storage', {
        expires: Date.now() + 1000,
      })
      return local.test
    })).toBe('hello proxy-web-storage')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.setDisposable('test')
      return local.test
    })).toBe('hello proxy-web-storage')

    await delay(500)

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe(undefined)
  })

  test('disposable after expired', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.setItem('test', 'hello proxy-web-storage', {
        expires: Date.now() + 1000,
      })
      return local.test
    })).toBe('hello proxy-web-storage')

    await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.setDisposable('test')
    })

    await delay(1000)

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe(undefined)
  })

  test('getOptions', async ({ page }) => {
    await page.goto('/')

    const options = {
      expires: Date.now() + 1000,
      disposable: true,
    }

    await page.evaluate((options) => {
      const { local } = window.proxyWebStorage
      local.setItem('test', 'hello proxy-web-storage', options)
    }, options)

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.getOptions('test')
    })).toEqual(options)
  })

  test('getOptions:expired', async ({ page }) => {
    await page.goto('/')

    const expires = Date.now() + 1000

    await page.evaluate((expires) => {
      const { local } = window.proxyWebStorage
      local.test = 'hello proxy-web-storage'
      local.setExpires('test', expires)
    }, expires)

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.getOptions('test')
    })).toEqual({ expires })
  })

  test('getOptions:disposable', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 'hello proxy-web-storage'
      local.setDisposable('test')
    })

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.getOptions('test')
    })).toEqual({ disposable: true })
  })
})
