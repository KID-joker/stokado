import { expect, test } from '@playwright/test'
import { decode } from '@/proxy/transform'
import type { StorageLike } from '@/types'

declare global {
  interface Window {
    proxyWebStorage: {
      local: StorageLike
      session: StorageLike
    }
  }
}

test.describe('serialized value', () => {
  test('number', async ({ page }) => {
    await page.goto('/')

    // 1
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 1
      return local.test
    })).toBe(1)

    // 0
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 0
      return local.test
    })).toBe(0)

    // -1
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = -1
      return local.test
    })).toBe(-1)

    // 2.71
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 2.71
      return local.test
    })).toBe(2.71)

    // NaN
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = NaN
      return local.test
    })).toBeNaN()

    // Infinity
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = Infinity
      return local.test
    })).toBe(Infinity)

    // -Infinity
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = -Infinity
      return local.test
    })).toBe(-Infinity)

    // new Number
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = new Number(3.14)
      return local.test
    })).toBe(3.14)
  })

  test('bigint', async ({ page }) => {
    await page.goto('/')

    // 1n
    expect(decode(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = 1n
      // Bug: https://github.com/microsoft/playwright/issues/22719
      return localStorage.test
    }))).toBe(1n)
  })

  test('boolean', async ({ page }) => {
    await page.goto('/')

    // true
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = true
      return local.test
    })).toBe(true)

    // false
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = false
      return local.test
    })).toBe(false)

    // new Boolean
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = new Boolean(false)
      return local.test
    })).toBe(false)
  })

  test('undefined', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = undefined
      return local.test
    })).toBeUndefined()
  })

  test('null', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = null
      return local.test
    })).toBeNull()
  })

  test('Object', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      // JSON.stringify don't know how to serialize a BigInt
      local.test = {
        $string: 'hello proxy-web-storage',
        $number: 0,
        $boolean: true,
        $null: null,
        $undefined: undefined,
      }
      return local.test
    })).toEqual({
      $string: 'hello proxy-web-storage',
      $number: 0,
      $boolean: true,
      $null: null,
      $undefined: undefined,
    })
  })

  test('Array', async ({ page }) => {
    await page.goto('/')

    // []
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = []
      return local.test
    })).toEqual([])

    // ['hello']
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test[0] = 'hello'
      return local.test
    })).toEqual(['hello'])

    // length
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test.length = 0
      return local.test
    })).toEqual([])

    // push
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test.push('hello', 'proxy-web-storage')
      return local.test
    })).toEqual(['hello', 'proxy-web-storage'])

    // pop
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      return local.test.pop()
    })).toBe('proxy-web-storage')
  })

  test('Date', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = new Date('2000-01-01T00:00:00.000Z')
      return local.test
    })).toEqual(new Date('2000-01-01T00:00:00.000Z'))
  })

  test('RegExp', async ({ page }) => {
    await page.goto('/')

    // new RegExp
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = new RegExp('ab+c')
      return local.test
    })).toEqual(new RegExp('ab+c'))

    // Literal
    expect(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = /ab+c/
      return local.test
    })).toEqual(/ab+c/)
  })

  test('Function', async ({ page }) => {
    await page.goto('/')

    // Function declaration
    expect(decode(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      function foo() {
        return 'hello proxy-web-storage!'
      }
      local.test = foo
      return localStorage.test
    }))()).toBe('hello proxy-web-storage!')

    // Function expression
    expect(decode(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = function () {
        return 'hello proxy-web-storage!'
      }
      return localStorage.test
    }))()).toBe('hello proxy-web-storage!')

    // Arrow function
    expect(decode(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = () => {
        return 'hello proxy-web-storage!'
      }
      return localStorage.test
    }))()).toBe('hello proxy-web-storage!')
  })

  test('Set', async ({ page }) => {
    await page.goto('/')

    expect(decode(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = new Set(['hello proxy-web-storage'])
      return localStorage.test
    }))).toEqual(new Set(['hello proxy-web-storage']))
  })

  test('Map', async ({ page }) => {
    await page.goto('/')

    expect(decode(await page.evaluate(() => {
      const { local } = window.proxyWebStorage
      local.test = new Map([['hello', 'proxy-web-storage'], ['foo', 'bar']])
      return localStorage.test
    }))).toEqual(new Map([['hello', 'proxy-web-storage'], ['foo', 'bar']]))
  })
})
