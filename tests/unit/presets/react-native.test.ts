import type { AsyncStorageLike } from '@/types'
import { beforeEach, describe, expect, it } from 'vitest'

function createMockAsyncStorage() {
  const store = new Map<string, string>()
  return {
    async getItem(key: string): Promise<string | null> {
      return store.get(key) ?? null
    },
    async setItem(key: string, value: string): Promise<void> {
      store.set(key, value)
    },
    async removeItem(key: string): Promise<void> {
      store.delete(key)
    },
    async clear(): Promise<void> {
      store.clear()
    },
    async getAllKeys(): Promise<string[]> {
      return [...store.keys()]
    },
  }
}

describe('createReactNativeStorage', () => {
  let asyncStorage: ReturnType<typeof createMockAsyncStorage>

  beforeEach(() => {
    asyncStorage = createMockAsyncStorage()
  })

  it('should implement AsyncStorageLike', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage: AsyncStorageLike = createReactNativeStorage(asyncStorage)
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('function')
  })

  it('should set and get items', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    await storage.setItem('foo', 'bar')
    expect(await storage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    expect(await storage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    await storage.setItem('foo', 'bar')
    await storage.removeItem('foo')
    expect(await storage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    await storage.setItem('a', '1')
    await storage.setItem('b', '2')
    await storage.clear()
    expect(await storage.length()).toBe(0)
  })

  it('should return key by index', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    await storage.setItem('first', '1')
    await storage.setItem('second', '2')
    expect(await storage.key(0)).toBe('first')
    expect(await storage.key(1)).toBe('second')
    expect(await storage.key(2)).toBeNull()
  })

  it('should report correct length', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    await storage.setItem('a', '1')
    await storage.setItem('b', '2')
    expect(await storage.length()).toBe(2)
  })
})
