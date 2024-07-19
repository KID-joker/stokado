import { expect, test } from '@playwright/test'
import { decode } from '@/proxy/transform'
import './global.d.ts'

test.describe('serialized value', () => {
  test('number', async ({ page }) => {
    await page.goto('/')

    // 1
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = 1
      return local.test
    })).toBe(1)

    // 0
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = 0
      return local.test
    })).toBe(0)

    // -1
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = -1
      return local.test
    })).toBe(-1)

    // 2.71
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = 2.71
      return local.test
    })).toBe(2.71)

    // NaN
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = NaN
      return local.test
    })).toBeNaN()

    // Infinity
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = Infinity
      return local.test
    })).toBe(Infinity)

    // -Infinity
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = -Infinity
      return local.test
    })).toBe(-Infinity)

    // new Number
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = new Number(3.14)
      return local.test
    })).toBe(3.14)
  })

  test('bigint', async ({ page }) => {
    await page.goto('/')

    // 1n
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = 1n
      return local.test
    })).toBe(1n)
  })

  test('boolean', async ({ page }) => {
    await page.goto('/')

    // true
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = true
      return local.test
    })).toBe(true)

    // false
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = false
      return local.test
    })).toBe(false)

    // new Boolean
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = new Boolean(false)
      return local.test
    })).toBe(false)
  })

  test('undefined', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = undefined
      return local.test
    })).toBeUndefined()
  })

  test('null', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = null
      return local.test
    })).toBeNull()
  })

  test('Object', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      // JSON.stringify don't know how to serialize a BigInt
      local.test = {
        $string: 'hello stokado',
        $number: 0,
        $boolean: true,
        $null: null,
        $undefined: undefined,
      }
      return local.test
    })).toEqual({
      $string: 'hello stokado',
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
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = []
      return local.test
    })).toEqual([])

    // ['hello']
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test[0] = 'hello'
      return local.test
    })).toEqual(['hello'])

    // length
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test.length = 0
      return local.test
    })).toEqual([])

    // push
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test.push('hello', 'stokado')
      return local.test
    })).toEqual(['hello', 'stokado'])

    // pop
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      return local.test.pop()
    })).toBe('stokado')
  })

  test('Date', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = new Date('2000-01-01T00:00:00.000Z')
      return local.test
    })).toEqual(new Date('2000-01-01T00:00:00.000Z'))
  })

  test('URL', async ({ page }) => {
    await page.goto('/')

    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = new URL('https://github.com/')
      return local.test
    })).toEqual(new URL('https://github.com/'))
  })

  test('RegExp', async ({ page }) => {
    await page.goto('/')

    // new RegExp
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = new RegExp('ab+c')
      return local.test
    })).toEqual(new RegExp('ab+c'))

    // Literal
    expect(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = /ab+c/
      return local.test
    })).toEqual(/ab+c/)
  })

  test('Function', async ({ page }) => {
    await page.goto('/')

    // Function declaration
    expect(decode(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      function foo() {
        return 'hello stokado!'
      }
      local.test = foo
      return localStorage.test
    }),
    ).value()).toBe('hello stokado!')

    // Function expression
    expect(decode(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = function () {
        return 'hello stokado!'
      }
      return localStorage.test
    }),
    ).value()).toBe('hello stokado!')

    // Arrow function
    expect(decode(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = () => {
        return 'hello stokado!'
      }
      return localStorage.test
    }),
    ).value()).toBe('hello stokado!')
  })

  test('Set', async ({ page }) => {
    await page.goto('/')

    expect(decode(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = new Set(['hello stokado'])
      return localStorage.test
    }),
    ).value).toEqual(new Set(['hello stokado']))
  })

  test('Map', async ({ page }) => {
    await page.goto('/')

    expect(decode(await page.evaluate(() => {
      const { createProxyStorage } = window.stokado
      const local = createProxyStorage(localStorage)
      local.test = new Map([['hello', 'stokado'], ['foo', 'bar']])
      return localStorage.test
    }),
    ).value).toEqual(new Map([['hello', 'stokado'], ['foo', 'bar']]))
  })
})
