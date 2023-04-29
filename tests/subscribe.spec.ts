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

test.describe('subscribe', async () => {
  test('on', async ({ context }) => {
    const page1 = await context.newPage()
    await page1.goto('/')

    // First-level object
    expect(await page1.evaluate(() => {
      const { local } = window.proxyWebStorage
      setTimeout(() => {
        local.test = {}
      })
      return new Promise((resolve) => {
        local.on('test', (newVal: any, oldVal: any) => {
          resolve({
            newVal,
            oldVal,
          })
        })
      })
    })).toEqual({
      newVal: {},
      oldVal: undefined,
    })

    // Second-level object
    expect(await page1.evaluate(() => {
      const { local } = window.proxyWebStorage
      setTimeout(() => {
        local.test = {}
        local.test.foo = 'bar'
      })
      return new Promise((resolve) => {
        local.on('test.foo', (newVal: any, oldVal: any) => {
          resolve({
            newVal,
            oldVal,
          })
        })
      })
    })).toEqual({ newVal: 'bar', oldVal: undefined })

    // two page
    const page2 = await context.newPage()
    await page2.goto('/')

    // clear
    page2.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.clear()
    })

    setTimeout(() => {
      page2.evaluate(() => {
        const { local } = window.proxyWebStorage
        local.test = {}
      })
    })

    // When localStorage is changed in different windows or tabs, the oldValue is null.
    expect(await page1.evaluate(() => {
      const { local } = window.proxyWebStorage
      return new Promise((resolve) => {
        local.on('test', (newVal: any, oldVal: any) => {
          resolve({
            newVal,
            oldVal,
          })
        })
      })
    })).toEqual({
      newVal: {},
      oldVal: null,
    })
  })

  test('once', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.count = 0
      local.once('test', () => {
        local.count++
      })
    })

    await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = {}
      local.test = []
    })

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.count
    })).toBe(1)
  })

  test('off', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.count = 0
      local.on('test', () => {
        local.count++
      })
    })

    await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = {}
      local.test = []
      local.off('test')
      local.test = 1
      local.test = true
    })

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.count
    })).toBe(2)
  })
})
