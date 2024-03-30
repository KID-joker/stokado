import { expect, test } from '@playwright/test'
import './global.d.ts'

test.describe('subscribe', async () => {
  test('on Object', async ({ context }) => {
    const page1 = await context.newPage()
    await page1.goto('/')

    // First-level object
    expect(await page1.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
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
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
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

    // // two page
    // const page2 = await context.newPage()
    // await page2.goto('/')

    // // clear
    // page2.evaluate(() => {
    //   const { createProxyStorage } = window.stokado
    //   const local = createProxyStorage(localStorage)
    //   local.clear()
    // })

    // setTimeout(() => {
    //   page2.evaluate(() => {
    //     const { createProxyStorage } = window.stokado
    //     const local = createProxyStorage(localStorage)
    //     local.test = {}
    //   })
    // })

    // // When localStorage is changed in different windows or tabs, the oldValue is null.
    // expect(await page1.evaluate(() => {
    //   const { createProxyStorage } = window.stokado
    //   const local = createProxyStorage(localStorage)
    //   return new Promise((resolve) => {
    //     local.on('test', (newVal: any, oldVal: any) => {
    //       resolve({
    //         newVal,
    //         oldVal,
    //       })
    //     })
    //   })
    // })).toEqual({
    //   newVal: {},
    //   oldVal: null,
    // })
  })

  test('on Array', async ({ context }) => {
    const page1 = await context.newPage()
    await page1.goto('/')

    expect(await page1.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      setTimeout(() => {
        local.test = ['hello', 'stokado']
        local.test.pop()
      })
      return new Promise((resolve) => {
        local.on('test.length', (newVal: any, oldVal: any) => {
          resolve({
            newVal,
            oldVal,
          })
        })
      })
    })).toEqual({
      newVal: 1,
      oldVal: 2,
    })

    // // another tab
    // const page2 = await context.newPage()
    // await page2.goto('/')

    // setTimeout(() => {
    //   page2.evaluate(() => {
    //     const { createProxyStorage } = window.stokado
    //     const local = createProxyStorage(localStorage)
    //     local.test = []
    //   })
    // })

    // expect(await page1.evaluate(() => {
    //   const { createProxyStorage } = window.stokado
    //   const local = createProxyStorage(localStorage)
    //   return new Promise((resolve) => {
    //     local.on('test.length', (newVal: any, oldVal: any) => {
    //       resolve({
    //         newVal,
    //         oldVal,
    //       })
    //     })
    //   })
    // })).toEqual({
    //   newVal: 0,
    //   oldVal: 1,
    // })
  })

  test('once', async ({ page }) => {
    await page.goto('/')

    // once
    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.count = 0
      local.once('test', () => {
        local.count++
      })
    })

    // trigger
    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = {}
      local.test = []
    })

    // count
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.count
    })).toBe(1)
  })

  test('off', async ({ page }) => {
    await page.goto('/')

    // on
    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.count = 0
      local.on('test', () => {
        local.count++
      })
    })

    // trigger and off
    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = {}
      local.test = []
      local.off('test')
      local.test = 1
      local.test = true
    })

    // count
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.count
    })).toBe(2)
  })
})
