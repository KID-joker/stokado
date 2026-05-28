import type { AsyncStorageLike, SyncStorageLike } from '@/types'
import { beforeEach, describe, expect, it } from 'vitest'

function createMockMiniProgramAPI() {
  const store = new Map<string, any>()
  return {
    getStorageSync(key: string) {
      return store.get(key) ?? ''
    },
    setStorageSync(key: string, data: any) {
      store.set(key, data)
    },
    removeStorageSync(key: string) {
      store.delete(key)
    },
    clearStorageSync() {
      store.clear()
    },
    getStorageInfoSync() {
      return { keys: [...store.keys()], currentSize: 0, limitSize: 0 }
    },
    async getStorage(options: { key: string }) {
      const data = store.get(options.key)
      return { data: data ?? '' }
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

describe('createMiniProgramStorage', () => {
  let api: ReturnType<typeof createMockMiniProgramAPI>

  beforeEach(() => {
    api = createMockMiniProgramAPI()
  })

  it('should implement SyncStorageLike', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage: SyncStorageLike = createMiniProgramStorage(api)
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('number')
  })

  it('should set and get items', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    storage.setItem('foo', 'bar')
    expect(storage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    expect(storage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    storage.setItem('foo', 'bar')
    storage.removeItem('foo')
    expect(storage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    storage.clear()
    expect(storage.length).toBe(0)
  })

  it('should return key by index', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    storage.setItem('first', '1')
    storage.setItem('second', '2')
    expect(storage.key(0)).toBe('first')
    expect(storage.key(1)).toBe('second')
    expect(storage.key(2)).toBeNull()
  })

  it('should report correct length', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    expect(storage.length).toBe(2)
  })
})

describe('createMiniProgramStorageAsync', () => {
  let api: ReturnType<typeof createMockMiniProgramAPI>

  beforeEach(() => {
    api = createMockMiniProgramAPI()
  })

  it('should implement AsyncStorageLike', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage: AsyncStorageLike = createMiniProgramStorageAsync(api)
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('function')
  })

  it('should set and get items', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    await storage.setItem('foo', 'bar')
    expect(await storage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    expect(await storage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    await storage.setItem('foo', 'bar')
    await storage.removeItem('foo')
    expect(await storage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    await storage.setItem('a', '1')
    await storage.setItem('b', '2')
    await storage.clear()
    expect(await storage.length()).toBe(0)
  })

  it('should return key by index', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    await storage.setItem('first', '1')
    await storage.setItem('second', '2')
    expect(await storage.key(0)).toBe('first')
    expect(await storage.key(1)).toBe('second')
    expect(await storage.key(2)).toBeNull()
  })

  it('should report correct length', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    await storage.setItem('a', '1')
    await storage.setItem('b', '2')
    expect(await storage.length()).toBe(2)
  })
})
