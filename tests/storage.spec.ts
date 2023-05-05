import { expect, test } from '@playwright/test'
import './global.d.ts'

test.describe('storage', () => {
  test('local first', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local, session } = window.stokado
      local.test = 'hello local'
      session.test = 'hello session'
    })

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe('hello local')

    expect(await page.evaluate(() => {
      const { session } = window.stokado
      return session.test
    })).toBe('hello session')
  })

  test('session first', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local, session } = window.stokado
      session.test = 'hello session'
      local.test = 'hello local'
    })

    expect(await page.evaluate(() => {
      const { session } = window.stokado
      return session.test
    })).toBe('hello session')

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe('hello local')
  })

  test('local disposable and session', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local, session } = window.stokado
      local.test = 'hello local'
      local.setDisposable('test')
      session.test = 'hello session'
    })

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe('hello local')

    expect(await page.evaluate(() => {
      const { session } = window.stokado
      return session.test
    })).toBe('hello session')

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe(undefined)
  })

  test('local only', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { local } = window.stokado
      local.test = 'hello local'
    })

    expect(await page.evaluate(() => {
      const { session } = window.stokado
      return session.test
    })).toBe(undefined)
  })

  test('session only', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { session } = window.stokado
      session.test = 'hello local'
    })

    expect(await page.evaluate(() => {
      const { local } = window.stokado
      return local.test
    })).toBe(undefined)
  })
})
