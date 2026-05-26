import { describe, expect, it } from 'vitest'
import { encode } from '@/serializer/encode'
import { decode } from '@/serializer/decode'

describe('Serializer', () => {
  describe('round-trip encode/decode', () => {
    function decodeValue(data: any): any {
      const result = decode(encode(data))
      return (result as any).value
    }

    it('String', () => {
      const encoded = encode('hello', {})
      const decoded = decode(encoded) as any
      expect(decoded.value).toBe('hello')
      expect(decoded.type).toBe('String')
    })

    it('Number', () => {
      expect(decodeValue(42)).toBe(42)
      expect(decodeValue(0)).toBe(0)
      expect(decodeValue(-1)).toBe(-1)
      expect(decodeValue(3.14)).toBe(3.14)
      expect(decodeValue(NaN)).toBeNaN()
      expect(decodeValue(Infinity)).toBe(Infinity)
      expect(decodeValue(-Infinity)).toBe(-Infinity)
    })

    it('BigInt', () => {
      expect(decodeValue(1n)).toBe(1n)
      expect(decodeValue(9007199254740993n)).toBe(9007199254740993n)
    })

    it('Boolean', () => {
      expect(decodeValue(true)).toBe(true)
      expect(decodeValue(false)).toBe(false)
    })

    it('Null', () => {
      expect(decodeValue(null)).toBeNull()
    })

    it('Undefined', () => {
      expect(decodeValue(undefined)).toBeUndefined()
    })

    it('Object', () => {
      const obj = { a: 1, b: 'test', c: null }
      expect(decodeValue(obj)).toEqual(obj)
    })

    it('Array', () => {
      const arr = [1, 'two', null, { nested: true }]
      expect(decodeValue(arr)).toEqual(arr)
    })

    it('Date', () => {
      const d = new Date('2024-01-01T00:00:00.000Z')
      expect(decodeValue(d)).toEqual(d)
    })

    it('URL', () => {
      const url = new URL('https://example.com/path?q=1')
      expect(decodeValue(url)).toEqual(url)
    })

    it('RegExp', () => {
      const regex = /ab+c/gi
      const result = decodeValue(regex)
      expect(result.source).toBe(regex.source)
      expect(result.flags).toBe(regex.flags)
    })

    it('Function', () => {
      const fn = () => 'hello'
      const result = decodeValue(fn)
      expect(result()).toBe('hello')
    })

    it('Set', () => {
      const s = new Set([1, 2, 3])
      expect(decodeValue(s)).toEqual(s)
    })

    it('Map', () => {
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
