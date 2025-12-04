import { expect, test } from '@playwright/test'
import './global.d.ts'

test.describe('disposable', () => {
  test('setDisposable', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = 'hello stokado'
      local.setDisposable('test')
    })

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test
    })).toBe('hello stokado')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test
    })).toBeUndefined()
  })

  test('setDisposable width set', async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = 'hello stokado'
      local.setDisposable('test')
    })

    await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = 'hello world'
    })

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test
    })).toBe('hello world')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test
    })).toBeUndefined()
  })

  test('setDisposable width object', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = { hello: 'world' }
      local.setDisposable('test')
      return local.test.hello
    })).toBe('world')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test
    })).toBeUndefined()

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = { hello: 'world' }
      local.setDisposable('test')
      local.test.hello = 'stokado'
      return local.test
    })).toBeUndefined()

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = { hello: 'world' }
      local.setDisposable('test')
      delete local.test.hello
      return local.test
    })).toBeUndefined()
  })
})
