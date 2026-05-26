import { describe, expect, it } from 'vitest'
import { CacheStore } from '@/cache/store'

describe('CacheStore', () => {
  it('get returns undefined for missing key', () => {
    const cache = new CacheStore()
    expect(cache.get('missing')).toBeUndefined()
  })

  it('set and get', () => {
    const cache = new CacheStore()
    cache.set('key', { value: 'hello', type: 'String' })
    expect(cache.get('key')).toEqual({ value: 'hello', type: 'String' })
  })

  it('delete removes the item', () => {
    const cache = new CacheStore()
    cache.set('key', { value: 42, type: 'Number' })
    cache.delete('key')
    expect(cache.get('key')).toBeUndefined()
  })

  it('has returns correct boolean', () => {
    const cache = new CacheStore()
    expect(cache.has('key')).toBe(false)
    cache.set('key', { value: true, type: 'Boolean' })
    expect(cache.has('key')).toBe(true)
  })

  it('clear removes all items', () => {
    const cache = new CacheStore()
    cache.set('a', { value: 1, type: 'Number' })
    cache.set('b', { value: 2, type: 'Number' })
    cache.clear()
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('object proxy caching', () => {
    const cache = new CacheStore()
    const proxy = { proxied: true }
    cache.setObjectProxy('key', proxy)
    expect(cache.getObjectProxy('key')).toBe(proxy)
  })

  it('deleteObjectProxy', () => {
    const cache = new CacheStore()
    const proxy = { proxied: true }
    cache.setObjectProxy('key', proxy)
    cache.deleteObjectProxy('key')
    expect(cache.getObjectProxy('key')).toBeUndefined()
  })

  it('clear also removes object proxies', () => {
    const cache = new CacheStore()
    cache.setObjectProxy('key', { proxied: true })
    cache.clear()
    expect(cache.getObjectProxy('key')).toBeUndefined()
  })

  it('delete also removes associated object proxy', () => {
    const cache = new CacheStore()
    cache.set('key', { value: {}, type: 'Object' })
    cache.setObjectProxy('key', { proxied: true })
    cache.delete('key')
    expect(cache.getObjectProxy('key')).toBeUndefined()
  })
})
