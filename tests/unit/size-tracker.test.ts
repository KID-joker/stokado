import { describe, expect, it, vi } from 'vitest'
import { SizeTracker } from '@/quota/size-tracker'

describe('sizeTracker', () => {
  it('add increments current size', () => {
    const tracker = new SizeTracker(1000)
    tracker.add('key', 'hello')
    expect(tracker.current).toBeGreaterThan(0)
  })

  it('add accounts for key name bytes', () => {
    const tracker = new SizeTracker(10000)
    tracker.add('short', 'val')
    const size1 = tracker.current
    tracker.remove('short')
    tracker.add('a-very-long-key-name-here', 'val')
    const size2 = tracker.current
    expect(size2).toBeGreaterThan(size1)
  })

  it('add with existing key updates delta', () => {
    const tracker = new SizeTracker(10000)
    tracker.add('key', 'short')
    const size1 = tracker.current
    tracker.add('key', 'a much longer value here')
    const size2 = tracker.current
    expect(size2).toBeGreaterThan(size1)
  })

  it('remove decrements current size', () => {
    const tracker = new SizeTracker(10000)
    tracker.add('key', 'hello')
    const sizeAfterAdd = tracker.current
    tracker.remove('key')
    expect(tracker.current).toBe(sizeAfterAdd - sizeAfterAdd)
    expect(tracker.current).toBe(0)
  })

  it('remove ignores unknown key', () => {
    const tracker = new SizeTracker(10000)
    tracker.add('key', 'hello')
    tracker.remove('unknown')
    expect(tracker.current).toBeGreaterThan(0)
  })

  it('clear resets all state', () => {
    const tracker = new SizeTracker(10000)
    tracker.add('a', '1')
    tracker.add('b', '2')
    tracker.clear()
    expect(tracker.current).toBe(0)
  })

  it('check returns true when under limit', () => {
    const tracker = new SizeTracker(10000)
    expect(tracker.check('key', 'hello', 'hello')).toBe(true)
  })

  it('check returns true when over limit and no callback', () => {
    const tracker = new SizeTracker(1)
    expect(tracker.check('key', 'hello', 'hello')).toBe(true)
  })

  it('check calls onQuotaExceeded when over limit', () => {
    const onQuotaExceeded = vi.fn()
    const tracker = new SizeTracker(1, onQuotaExceeded)
    tracker.check('key', 'hello', 'hello')
    expect(onQuotaExceeded).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'key', value: 'hello', limit: 1 }),
    )
  })

  it('check returns false when callback returns false', () => {
    const onQuotaExceeded = vi.fn().mockReturnValue(false)
    const tracker = new SizeTracker(1, onQuotaExceeded)
    expect(tracker.check('key', 'hello', 'hello')).toBe(false)
  })

  it('check returns true when callback returns undefined', () => {
    const onQuotaExceeded = vi.fn().mockReturnValue(undefined)
    const tracker = new SizeTracker(1, onQuotaExceeded)
    expect(tracker.check('key', 'hello', 'hello')).toBe(true)
  })

  it('check with async callback returning false', async () => {
    const onQuotaExceeded = vi.fn().mockResolvedValue(false)
    const tracker = new SizeTracker(1, onQuotaExceeded)
    const result = tracker.check('key', 'hello', 'hello')
    expect(result).toBeInstanceOf(Promise)
    expect(await result).toBe(false)
  })

  it('check with async callback returning undefined', async () => {
    const onQuotaExceeded = vi.fn().mockResolvedValue(undefined)
    const tracker = new SizeTracker(1, onQuotaExceeded)
    const result = tracker.check('key', 'hello', 'hello')
    expect(await result).toBe(true)
  })

  it('check accounts for existing key size when computing delta', () => {
    const tracker = new SizeTracker(10000)
    tracker.add('key', 'short')
    expect(tracker.check('key', 'a much longer value', 'a much longer value')).toBe(true)
  })

  it('getUsage returns current and limit', () => {
    const tracker = new SizeTracker(5000)
    tracker.add('key', 'hello')
    const usage = tracker.getUsage()
    expect(usage.limit).toBe(5000)
    expect(usage.current).toBe(tracker.current)
  })

  it('init scans sync storage keys', () => {
    const store = new Map<string, string>()
    store.set('a', 'value-a')
    store.set('b', 'value-b')
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() { return store.size },
    }
    const tracker = new SizeTracker(10000)
    tracker.init(storage, { isAsync: false })
    expect(tracker.current).toBeGreaterThan(0)
  })

  it('init scans async storage keys', async () => {
    const store = new Map<string, string>()
    store.set('a', 'value-a')
    const storage = {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => { store.set(key, value) },
      removeItem: async (key: string) => { store.delete(key) },
      clear: async () => { store.clear() },
      key: async (index: number) => Array.from(store.keys())[index] ?? null,
      length: async () => store.size,
    }
    const tracker = new SizeTracker(10000)
    const result = tracker.init(storage, { isAsync: true })
    expect(result).toBeInstanceOf(Promise)
    await result
    expect(tracker.current).toBeGreaterThan(0)
  })

  it('init skips stokado probe key', () => {
    const store = new Map<string, string>()
    store.set('__stokado_probe__', 'test')
    store.set('real', 'value')
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() { return store.size },
    }
    const tracker = new SizeTracker(10000)
    tracker.init(storage, { isAsync: false })
    expect(tracker.current).toBeGreaterThan(0)
  })
})
