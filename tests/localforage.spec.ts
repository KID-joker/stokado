import { expect, test } from '@playwright/test'
import './global.d.ts'

async function delay(ms?: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

test.describe('localforage', () => {
  test('base', async ({ page }) => {
    await page.goto('/')

    // set
    await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      await (local.test = 'hello stokado')
    })

    // get
    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      return await local.test
    })).toBe('hello stokado')

    // delete
    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      await (delete local.test)
      return await local.test
    })).toBeUndefined()
  })

  test('methods', async ({ page }) => {
    await page.goto('/')

    // key() setItem()
    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      await (local.test = 'hello localforage')
      await local.setItem('test', 'hello stokado')
      await local.setItem('foo', 'bar')
      return await local.key(0)
    })).toBe('foo')

    // getItem()
    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      return await local.getItem('test')
    })).toBe('hello stokado')

    // length
    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      return await local.length()
    })).toBe(2)

    // removeItem()
    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      await local.removeItem('test')
      return await local.test
    })).toBeUndefined()

    // clear()
    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      await local.clear()
      return await local.length()
    })).toEqual(0)
  })

  test('subscribe', async ({ context }) => {
    const page1 = await context.newPage()
    await page1.goto('/')

    expect(await page1.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage, 'localforage')
      return new Promise(async (resolve) => {
        local.on('test.length', (newVal: any, oldVal: any) => {
          resolve({
            newVal,
            oldVal,
          })
        })

        local.test = ['hello', 'stokado'];
        (await local.test).pop()
      })
    })).toEqual({
      newVal: 1,
      oldVal: 2,
    })

    // another tab
    const page2 = await context.newPage()
    await page2.goto('/')

    setTimeout(() => {
      page2.evaluate(() => {
        const { createProxyStorage } = window.stokado
        const local = createProxyStorage(window.localforage, 'localforage')
        local.test = []
      })
    })

    expect(await page1.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage, 'localforage')
      return new Promise((resolve) => {
        local.on('test.length', (newVal: any, oldVal: any) => {
          resolve({
            newVal,
            oldVal,
          })
        })
      })
    })).toEqual({
      newVal: 0,
      oldVal: 1,
    })
  })

  test('expired', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      await (local.test = 'hello stokado')
      await local.setExpires('test', Date.now() + 1000)
      return await local.test
    })).toBe('hello stokado')

    await delay(500)

    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      return await local.test
    })).toBe('hello stokado')

    await delay(500)

    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      return await local.test
    })).toBeUndefined()
  })

  test('disposable', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      await (local.test = 'hello stokado')
      await local.setDisposable('test')
    })

    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      return await local.test
    })).toBe('hello stokado')

    expect(await page.evaluate(async () => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      return await local.test
    })).toBeUndefined()
  })

  test('setOptions', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      local.setItem('test', 'hello stokado', {
        expires: Date.now() + 1000,
      })
      return local.test
    })).toBe('hello stokado')

    await delay(500)

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      return local.test
    })).toBe('hello stokado')

    await delay(500)

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(window.localforage)
      return local.test
    })).toBeUndefined()
  })
})
