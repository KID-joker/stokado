import { describe, expect, it, vi } from 'vitest'
import { CacheStore } from '@/cache/store'
import { StorageOperator } from '@/core/operator'
import { StorageBroadcast } from '@/events/broadcast'
import { EventEmitter } from '@/events/emitter'
import { SizeTracker } from '@/quota/size-tracker'
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
    null,
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
    null,
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

describe('storageOperator - Quota (Sync)', () => {
  function createSyncOperatorWithQuota(quota: number, onQuotaExceeded?: any) {
    const storage = createMockSyncStorage()
    const sizeTracker = new SizeTracker(quota, onQuotaExceeded)
    const operator = new StorageOperator(
      storage,
      new SyncScheduler(),
      new SyncStrategy(),
      new CacheStore(),
      new EventEmitter(),
      new StorageBroadcast(null),
      sizeTracker,
    )
    return { operator, sizeTracker, storage }
  }

  it('tracks size after setItem', () => {
    const { operator, sizeTracker } = createSyncOperatorWithQuota(10000)
    operator.setItem('key', 'hello')
    expect(sizeTracker.current).toBeGreaterThan(0)
  })

  it('tracks size after removeItem', () => {
    const { operator, sizeTracker } = createSyncOperatorWithQuota(10000)
    operator.setItem('key', 'hello')
    const sizeAfterSet = sizeTracker.current
    operator.removeItem('key')
    expect(sizeTracker.current).toBeLessThan(sizeAfterSet)
  })

  it('tracks size after clear', () => {
    const { operator, sizeTracker } = createSyncOperatorWithQuota(10000)
    operator.setItem('a', 1)
    operator.setItem('b', 2)
    operator.clear()
    expect(sizeTracker.current).toBe(0)
  })

  it('calls onQuotaExceeded when over limit', () => {
    const onQuotaExceeded = vi.fn()
    const { operator } = createSyncOperatorWithQuota(1, onQuotaExceeded)
    operator.setItem('key', 'hello')
    expect(onQuotaExceeded).toHaveBeenCalled()
  })

  it('blocks write when callback returns false', () => {
    const onQuotaExceeded = vi.fn().mockReturnValue(false)
    const { operator, storage } = createSyncOperatorWithQuota(1, onQuotaExceeded)
    operator.setItem('key', 'hello')
    expect(storage.getItem('key')).toBeNull()
  })

  it('allows write when callback returns undefined', () => {
    const onQuotaExceeded = vi.fn().mockReturnValue(undefined)
    const { operator, storage } = createSyncOperatorWithQuota(1, onQuotaExceeded)
    operator.setItem('key', 'hello')
    expect(storage.getItem('key')).not.toBeNull()
  })
})

describe('storageOperator - Quota (Async)', () => {
  function createAsyncOperatorWithQuota(quota: number, onQuotaExceeded?: any) {
    const storage = createMockAsyncStorage()
    const sizeTracker = new SizeTracker(quota, onQuotaExceeded)
    const operator = new StorageOperator(
      storage,
      new AsyncScheduler(),
      new AsyncStrategy(),
      new CacheStore(),
      new EventEmitter(),
      new StorageBroadcast(null),
      sizeTracker,
    )
    return { operator, sizeTracker, storage }
  }

  it('tracks size after setItem', async () => {
    const { operator, sizeTracker } = createAsyncOperatorWithQuota(10000)
    await operator.setItem('key', 'hello')
    expect(sizeTracker.current).toBeGreaterThan(0)
  })

  it('blocks write when async callback returns false', async () => {
    const onQuotaExceeded = vi.fn().mockResolvedValue(false)
    const { operator, storage } = createAsyncOperatorWithQuota(1, onQuotaExceeded)
    await operator.setItem('key', 'hello')
    expect(await storage.getItem('key')).toBeNull()
  })

  it('allows write when async callback returns undefined', async () => {
    const onQuotaExceeded = vi.fn().mockResolvedValue(undefined)
    const { operator, storage } = createAsyncOperatorWithQuota(1, onQuotaExceeded)
    await operator.setItem('key', 'hello')
    expect(await storage.getItem('key')).not.toBeNull()
  })
})
