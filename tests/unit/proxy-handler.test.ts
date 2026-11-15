import type { SyncStorageLike } from '@/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProxyStorage } from '@/index'

function createStorage(isAsync: boolean) {
  const items = new Map<string, string>()
  const syncStorage: SyncStorageLike = {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => { items.set(key, value) },
    removeItem: (key) => { items.delete(key) },
    clear: () => { items.clear() },
    key: index => [...items.keys()][index] ?? null,
    get length() { return items.size },
  }
  const asyncStorage = {
    getItem: async (key: string) => syncStorage.getItem(key),
    setItem: async (key: string, value: string) => syncStorage.setItem(key, value),
    removeItem: async (key: string) => syncStorage.removeItem(key),
    clear: async () => syncStorage.clear(),
    key: async (index: number) => syncStorage.key(index),
    length: async () => syncStorage.length,
  }
  const reload = () => isAsync
    ? createProxyStorage(asyncStorage)
    : createProxyStorage(syncStorage)

  return { storage: reload(), reload }
}

describe.each([false, true])('proxy property reads (async: %s)', (isAsync) => {
  beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function expectRead(result: any, expected: any) {
    if (isAsync)
      return expect(result).resolves.toBe(expected)
    expect(result).toBe(expected)
  }

  it('preserves null after property assignment', async () => {
    const { storage } = createStorage(isAsync)
    storage.test = null

    await expectRead(storage.test, null)
    await expectRead(storage.getItem('test'), null)
  })

  it('returns undefined for missing and removed properties', async () => {
    const { storage } = createStorage(isAsync)
    await expectRead(storage.missing, undefined)
    await expectRead(storage.getItem('missing'), null)

    await storage.setItem('test', null)
    await storage.removeItem('test')
    await expectRead(storage.test, undefined)
    await expectRead(storage.getItem('test'), null)
  })

  describe.each([false, true])('with fresh proxy: %s', (fresh) => {
    it('preserves stored null', async () => {
      const { storage, reload } = createStorage(isAsync)
      await storage.setItem('test', null)
      const reader = fresh ? reload() : storage

      await expectRead(reader.test, null)
      await expectRead(reader.getItem('test'), null)
    })

    it('returns undefined for expired null', async () => {
      const { storage, reload } = createStorage(isAsync)
      await storage.setItem('test', null, { expires: Date.now() - 1000 })
      const reader = fresh ? reload() : storage

      await expectRead(reader.test, undefined)
      await expectRead(reader.getItem('test'), null)
    })

    it('returns disposable null once, then undefined', async () => {
      const { storage, reload } = createStorage(isAsync)
      await storage.setItem('test', null, { disposable: true })
      const reader = fresh ? reload() : storage

      await expectRead(reader.test, null)
      await expectRead(reader.test, undefined)
      await expectRead(reader.getItem('test'), null)
    })
  })
})
