import type { SyncStorageLike } from '@/types'
import { describe, expect, it } from 'vitest'

describe('memoryStorage', () => {
  it('should implement SyncStorageLike', async () => {
    const { memoryStorage } = await import('@/presets/node')
    const storage: SyncStorageLike = memoryStorage
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('number')
  })

  it('should set and get items', async () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.setItem('foo', 'bar')
    expect(memoryStorage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.clear()
    expect(memoryStorage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.setItem('foo', 'bar')
    memoryStorage.removeItem('foo')
    expect(memoryStorage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.setItem('a', '1')
    memoryStorage.setItem('b', '2')
    memoryStorage.clear()
    expect(memoryStorage.length).toBe(0)
  })

  it('should return key by index', async () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.clear()
    memoryStorage.setItem('first', '1')
    memoryStorage.setItem('second', '2')
    expect(memoryStorage.key(0)).toBe('first')
    expect(memoryStorage.key(1)).toBe('second')
    expect(memoryStorage.key(2)).toBeNull()
  })

  it('should report correct length', async () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.clear()
    memoryStorage.setItem('a', '1')
    memoryStorage.setItem('b', '2')
    expect(memoryStorage.length).toBe(2)
  })
})
