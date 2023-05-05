import { expect, test } from '@playwright/test'
import './global.d.ts'

async function delay(ms?: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

test.describe('setItem', async () => {
  test('expired', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.setItem('test', 'hello stokado', {
        expires: Date.now() + 1000,
      })
      return local.test
    })).toBe('hello stokado')

    await delay(500)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe('hello stokado')

    await delay(500)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe(undefined)
  })

  test('expired after disposable', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.setItem('test', 'hello stokado', {
        expires: Date.now() + 1000,
      })
      return local.test
    })).toBe('hello stokado')

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.setDisposable('test')
      return local.test
    })).toBe('hello stokado')

    await delay(500)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe(undefined)
  })

  test('disposable after expired', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      local.setItem('test', 'hello stokado', {
        expires: Date.now() + 1000,
      })
      return local.test
    })).toBe('hello stokado')

    await page.evaluate(() => {
      const { local } = window.stokado
      local.setDisposable('test')
    })

    await delay(1000)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
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
      const { local } = window.stokado
      local.setItem('test', 'hello stokado', options)
    }, options)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.getOptions('test')
    })).toEqual(options)
  })

  test('getOptions:expired', async ({ page }) => {
    await page.goto('/')

    const expires = Date.now() + 1000

    await page.evaluate((expires) => {
      const { local } = window.stokado
      local.test = 'hello stokado'
      local.setExpires('test', expires)
    }, expires)

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.getOptions('test')
    })).toEqual({ expires })
  })

  test('getOptions:disposable', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local } = window.stokado
      local.test = 'hello stokado'
      local.setDisposable('test')
    })

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.getOptions('test')
    })).toEqual({ disposable: true })
  })
})
