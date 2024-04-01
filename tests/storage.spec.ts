import { expect, test } from '@playwright/test'
import './global.d.ts'

test.describe('storage', () => {
  test('local first', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      const session = createProxyStorage(sessionStorage)
      local.test = 'hello local'
      session.test = 'hello session'
    })

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test
    })).toBe('hello local')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const session = createProxyStorage(sessionStorage)
      return session.test
    })).toBe('hello session')
  })

  test('session first', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const session = createProxyStorage(sessionStorage)
      const local = createProxyStorage(localStorage)
      session.test = 'hello session'
      local.test = 'hello local'
    })

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const session = createProxyStorage(sessionStorage)
      return session.test
    })).toBe('hello session')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test
    })).toBe('hello local')
  })

  test('local disposable and session', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      const session = createProxyStorage(sessionStorage)
      local.test = 'hello local'
      local.setDisposable('test')
      session.test = 'hello session'
    })

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test
    })).toBe('hello local')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const session = createProxyStorage(sessionStorage)
      return session.test
    })).toBe('hello session')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test
    })).toBeUndefined()
  })

  test('local only', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = 'hello local'
    })

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const session = createProxyStorage(sessionStorage)
      return session.test
    })).toBeUndefined()
  })

  test('session only', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const session = createProxyStorage(sessionStorage)
      session.test = 'hello local'
    })

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test
    })).toBeUndefined()
  })
})
