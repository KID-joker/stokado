import type { SyncStorageLike } from '@/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let cookieStore: Record<string, string> = {}

vi.stubGlobal('document', {
  get cookie() {
    return Object.entries(cookieStore)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('; ')
  },
  set cookie(val: string) {
    const [pair] = val.split(';')
    const eqIndex = pair.indexOf('=')
    if (eqIndex === -1)
      return
    const key = decodeURIComponent(pair.slice(0, eqIndex).trim())
    const value = decodeURIComponent(pair.slice(eqIndex + 1).trim())
    if (value === '' && val.includes('expires=')) {
      delete cookieStore[key]
    }
    else {
      cookieStore[key] = value
    }
  },
})

describe('cookieStorage', () => {
  beforeEach(() => {
    cookieStore = {}
  })

  it('should implement SyncStorageLike', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    const storage: SyncStorageLike = cookieStorage
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('number')
  })

  it('should set and get items', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('foo', 'bar')
    expect(cookieStorage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    expect(cookieStorage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('foo', 'bar')
    cookieStorage.removeItem('foo')
    expect(cookieStorage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('a', '1')
    cookieStorage.setItem('b', '2')
    cookieStorage.clear()
    expect(cookieStorage.length).toBe(0)
  })

  it('should return key by index', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('first', '1')
    cookieStorage.setItem('second', '2')
    const keys = [cookieStorage.key(0), cookieStorage.key(1)]
    expect(keys).toContain('first')
    expect(keys).toContain('second')
    expect(cookieStorage.key(2)).toBeNull()
  })

  it('should report correct length', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('a', '1')
    cookieStorage.setItem('b', '2')
    expect(cookieStorage.length).toBe(2)
  })

  it('should handle special characters', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('key with spaces', 'value=with=equals')
    expect(cookieStorage.getItem('key with spaces')).toBe('value=with=equals')
  })
})
