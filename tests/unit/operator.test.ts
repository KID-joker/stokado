import { describe, expect, it, vi } from 'vitest'
import { CacheStore } from '@/cache/store'
import { StorageOperator } from '@/core/operator'
import { StorageBroadcast } from '@/events/broadcast'
import { EventEmitter } from '@/events/emitter'
import { AsyncScheduler } from '@/scheduler/async-scheduler'
import { SyncScheduler } from '@/scheduler/sync-scheduler'
import { AsyncStrategy } from '@/strategy/async-strategy'
import { SyncStrategy } from '@/strategy/sync-strategy'

function createMockSyncStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size },
  }
}

function createMockAsyncStorage() {
  const store = new Map<string, string>()
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => { store.set(key, value) },
    removeItem: async (key: string) => { store.delete(key) },
    clear: async () => { store.clear() },
    key: async (index: number) => Array.from(store.keys())[index] ?? null,
    length: async () => store.size,
  }
}

function createSyncOperator(storage?: any) {
  const s = storage ?? createMockSyncStorage()
  return new StorageOperator(
    s,
    new SyncScheduler(),
    new SyncStrategy(),
    new CacheStore(),
    new EventEmitter(),
    new StorageBroadcast(null),
  )
}

function createAsyncOperator(storage?: any) {
  const s = storage ?? createMockAsyncStorage()
  return new StorageOperator(
    s,
    new AsyncScheduler(),
    new AsyncStrategy(),
    new CacheStore(),
    new EventEmitter(),
    new StorageBroadcast(null),
  )
}

describe('storageOperator - Sync', () => {
  it('setItem and getItem round-trip', () => {
    const op = createSyncOperator()
    op.setItem('name', 'hello')
    expect(op.getItem('name')).toBe('hello')
  })

  it('getItem returns null for missing key', () => {
    const op = createSyncOperator()
    expect(op.getItem('missing')).toBeNull()
  })

  it('removeItem deletes the value', () => {
    const op = createSyncOperator()
    op.setItem('key', 'val')
    op.removeItem('key')
    expect(op.getItem('key')).toBeNull()
  })

  it('clear removes all items', () => {
    const op = createSyncOperator()
    op.setItem('a', 1)
    op.setItem('b', 2)
    op.clear()
    expect(op.getItem('a')).toBeNull()
    expect(op.getItem('b')).toBeNull()
  })

  it('emits events on setItem', () => {
    const op = createSyncOperator()
    const fn = vi.fn()
    op.emitter.on('key', fn)
    op.setItem('key', 'val')
    expect(fn).toHaveBeenCalledWith('val', undefined)
  })

  it('does not emit event when setting same value', () => {
    const op = createSyncOperator()
    op.setItem('key', 'val')
    const fn = vi.fn()
    op.emitter.on('key', fn)
    op.setItem('key', 'val')
    expect(fn).not.toHaveBeenCalled()
  })

  it('emits events on removeItem', () => {
    const op = createSyncOperator()
    op.setItem('key', 'val')
    const fn = vi.fn()
    op.emitter.on('key', fn)
    op.removeItem('key')
    expect(fn).toHaveBeenCalledWith(undefined, 'val')
  })

  it('preserves object reference equality', () => {
    const op = createSyncOperator()
    op.setItem('obj', { a: 1 })
    const first = op.getItem('obj')
    const second = op.getItem('obj')
    expect(first).toBe(second)
  })

  it('type preservation — Number', () => {
    const op = createSyncOperator()
    op.setItem('n', 42)
    expect(op.getItem('n')).toBe(42)
  })

  it('type preservation — Boolean', () => {
    const op = createSyncOperator()
    op.setItem('b', false)
    expect(op.getItem('b')).toBe(false)
  })

  it('type preservation — null', () => {
    const op = createSyncOperator()
    op.setItem('n', null)
    expect(op.getItem('n')).toBeNull()
  })
})

describe('storageOperator - Async', () => {
  it('setItem and getItem round-trip', async () => {
    const op = createAsyncOperator()
    await op.setItem('name', 'hello')
    expect(await op.getItem('name')).toBe('hello')
  })

  it('getItem returns null for missing key', async () => {
    const op = createAsyncOperator()
    expect(await op.getItem('missing')).toBeNull()
  })

  it('removeItem deletes the value', async () => {
    const op = createAsyncOperator()
    await op.setItem('key', 'val')
    await op.removeItem('key')
    expect(await op.getItem('key')).toBeNull()
  })

  it('clear waits for all queues then clears', async () => {
    const op = createAsyncOperator()
    await op.setItem('a', 1)
    await op.setItem('b', 2)
    await op.clear()
    expect(await op.getItem('a')).toBeNull()
    expect(await op.getItem('b')).toBeNull()
  })
})

describe('storageOperator - Race Condition (Issue 3.3)', () => {
  it('getItem after removeItem on same key returns null', async () => {
    const op = createAsyncOperator()
    await op.setItem('key', 'value')
    const removePromise = op.removeItem('key')
    const getPromise = op.getItem('key')
    await removePromise
    const result = await getPromise
    expect(result).toBeNull()
  })

  it('setItem then getItem returns new value even when async', async () => {
    const op = createAsyncOperator()
    await op.setItem('key', 'old')
    const setPromise = op.setItem('key', 'new')
    const getPromise = op.getItem('key')
    await setPromise
    expect(await getPromise).toBe('new')
  })
})
