import type { AsyncStorageLike, SyncStorageLike } from '@/types'
import { beforeEach, describe, expect, it } from 'vitest'

function createMockAlipayAPI() {
  const store = new Map<string, any>()
  return {
    getStorageSync(options: { key: string }) {
      const data = store.get(options.key)
      return { data: data !== undefined ? data : null }
    },
    setStorageSync(options: { key: string, data: any }) {
      store.set(options.key, options.data)
    },
    removeStorageSync(options: { key: string }) {
      store.delete(options.key)
    },
    clearStorageSync() {
      store.clear()
    },
    getStorageInfoSync() {
      return { keys: [...store.keys()], currentSize: 0, limitSize: 0 }
    },
    async getStorage(options: { key: string }) {
      const data = store.get(options.key)
      return { data: data !== undefined ? data : null }
    },
    async setStorage(options: { key: string, data: any }) {
      store.set(options.key, options.data)
    },
    async removeStorage(options: { key: string }) {
      store.delete(options.key)
    },
    async clearStorage() {
      store.clear()
    },
    async getStorageInfo() {
      return { keys: [...store.keys()], currentSize: 0, limitSize: 0 }
    },
  }
}

describe('createAlipayStorage', () => {
  let api: ReturnType<typeof createMockAlipayAPI>

  beforeEach(() => {
    api = createMockAlipayAPI()
  })

  it('should implement SyncStorageLike', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage: SyncStorageLike = createAlipayStorage(api)
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('number')
  })

  it('should set and get items', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage = createAlipayStorage(api)
    storage.setItem('foo', 'bar')
    expect(storage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage = createAlipayStorage(api)
    expect(storage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage = createAlipayStorage(api)
    storage.setItem('foo', 'bar')
    storage.removeItem('foo')
    expect(storage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage = createAlipayStorage(api)
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    storage.clear()
    expect(storage.length).toBe(0)
  })

  it('should return key by index', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage = createAlipayStorage(api)
    storage.setItem('first', '1')
    storage.setItem('second', '2')
    expect(storage.key(0)).toBe('first')
    expect(storage.key(1)).toBe('second')
    expect(storage.key(2)).toBeNull()
  })
})

describe('createAlipayStorageAsync', () => {
  let api: ReturnType<typeof createMockAlipayAPI>

  beforeEach(() => {
    api = createMockAlipayAPI()
  })

  it('should implement AsyncStorageLike', async () => {
    const { createAlipayStorageAsync } = await import('@/presets/alipay')
    const storage: AsyncStorageLike = createAlipayStorageAsync(api)
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('function')
  })

  it('should set and get items', async () => {
    const { createAlipayStorageAsync } = await import('@/presets/alipay')
    const storage = createAlipayStorageAsync(api)
    await storage.setItem('foo', 'bar')
    expect(await storage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { createAlipayStorageAsync } = await import('@/presets/alipay')
    const storage = createAlipayStorageAsync(api)
    expect(await storage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { createAlipayStorageAsync } = await import('@/presets/alipay')
    const storage = createAlipayStorageAsync(api)
    await storage.setItem('foo', 'bar')
    await storage.removeItem('foo')
    expect(await storage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { createAlipayStorageAsync } = await import('@/presets/alipay')
    const storage = createAlipayStorageAsync(api)
    await storage.setItem('a', '1')
    await storage.setItem('b', '2')
    await storage.clear()
    expect(await storage.length()).toBe(0)
  })
})
