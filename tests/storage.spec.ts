import { expect, test } from '@playwright/test'
import './global.d.ts'

test.describe('storage', () => {
  test('local first', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local, session } = window.proxyWebStorage
      local.test = 'hello local'
      session.test = 'hello session'
    })

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe('hello local')

    expect(await page.evaluate(() => {
      const { session } = window.proxyWebStorage
      return session.test
    })).toBe('hello session')
  })

  test('session first', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local, session } = window.proxyWebStorage
      session.test = 'hello session'
      local.test = 'hello local'
    })

    expect(await page.evaluate(() => {
      const { session } = window.proxyWebStorage
      return session.test
    })).toBe('hello session')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe('hello local')
  })

  test('local disposable and session', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local, session } = window.proxyWebStorage
      local.test = 'hello local'
      local.setDisposable('test')
      session.test = 'hello session'
    })

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe('hello local')

    expect(await page.evaluate(() => {
      const { session } = window.proxyWebStorage
      return session.test
    })).toBe('hello session')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe(undefined)
  })

  test('local only', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 'hello local'
    })

    expect(await page.evaluate(() => {
      const { session } = window.proxyWebStorage
      return session.test
    })).toBe(undefined)
  })

  test('session only', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { session } = window.proxyWebStorage
      session.test = 'hello local'
    })

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test
    })).toBe(undefined)
  })
})
