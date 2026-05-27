import { describe, expect, it } from 'vitest'
import { decode } from '@/serializer/decode'
import { encode } from '@/serializer/encode'

describe('serializer', () => {
  describe('round-trip encode/decode', () => {
    function decodeValue(data: any): any {
      const result = decode(encode(data))
      return (result as any).value
    }

    it('string', () => {
      const encoded = encode('hello', {})
      const decoded = decode(encoded) as any
      expect(decoded.value).toBe('hello')
      expect(decoded.type).toBe('String')
    })

    it('number', () => {
      expect(decodeValue(42)).toBe(42)
      expect(decodeValue(0)).toBe(0)
      expect(decodeValue(-1)).toBe(-1)
      expect(decodeValue(3.14)).toBe(3.14)
      expect(decodeValue(Number.NaN)).toBeNaN()
      expect(decodeValue(Infinity)).toBe(Infinity)
      expect(decodeValue(-Infinity)).toBe(-Infinity)
    })

    it('bigInt', () => {
      expect(decodeValue(1n)).toBe(1n)
      expect(decodeValue(9007199254740993n)).toBe(9007199254740993n)
    })

    it('boolean', () => {
      expect(decodeValue(true)).toBe(true)
      expect(decodeValue(false)).toBe(false)
    })

    it('null', () => {
      expect(decodeValue(null)).toBeNull()
    })

    it('undefined', () => {
      expect(decodeValue(undefined)).toBeUndefined()
    })

    it('object', () => {
      const obj = { a: 1, b: 'test', c: null }
      expect(decodeValue(obj)).toEqual(obj)
    })

    it('array', () => {
      const arr = [1, 'two', null, { nested: true }]
      expect(decodeValue(arr)).toEqual(arr)
    })

    it('date', () => {
      const d = new Date('2024-01-01T00:00:00.000Z')
      expect(decodeValue(d)).toEqual(d)
    })

    it('uRL', () => {
      const url = new URL('https://example.com/path?q=1')
      expect(decodeValue(url)).toEqual(url)
    })

    it('regExp', () => {
      const regex = /ab+c/gi
      const result = decodeValue(regex)
      expect(result.source).toBe(regex.source)
      expect(result.flags).toBe(regex.flags)
    })

    it('function', () => {
      const fn = () => 'hello'
      const result = decodeValue(fn)
      expect(result()).toBe('hello')
    })

    it('set', () => {
      const s = new Set([1, 2, 3])
      expect(decodeValue(s)).toEqual(s)
    })

    it('map', () => {
      const m = new Map([['a', 1], ['b', 2]])
      expect(decodeValue(m)).toEqual(m)
    })
  })

  describe('options preservation', () => {
    it('preserves expires option', () => {
      const options = { expires: Date.now() + 1000 }
      const decoded = decode(encode('test', options)) as any
      expect(decoded.options).toEqual(options)
    })

    it('preserves disposable option', () => {
      const options = { disposable: true }
      const decoded = decode(encode('test', options)) as any
      expect(decoded.options).toEqual(options)
    })

    it('handles no options', () => {
      const decoded = decode(encode('test')) as any
      expect(decoded.options).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('decode returns null for null input', () => {
      expect(decode(null)).toBeNull()
    })

    it('decode returns the string for non-JSON input', () => {
      expect(decode('plain string')).toBe('plain string')
    })

    it('decode returns parsed object for unrecognized type', () => {
      const raw = JSON.stringify({ type: 'Unknown', value: 'test' })
      expect(decode(raw)).toEqual({ type: 'Unknown', value: 'test' })
    })

    it('encode throws for unsupported types', () => {
      expect(() => encode(Symbol('test') as any)).toThrow()
    })
  })
})
