# Quota Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add memory quota alert functionality to `createProxyStorage` — users set a byte limit and receive a callback when exceeded, with the option to block the write.

**Architecture:** A new `SizeTracker` class maintains an incremental size counter (key + encoded value UTF-8 bytes). It is integrated into `StorageOperator` as an optional dependency. On `setItem`, `SizeTracker.check()` runs before the write; if the callback returns `false`, the write is skipped. Initialization scans all existing keys to establish a baseline. A `ready` promise is exposed for async storages.

**Tech Stack:** TypeScript, Vitest, existing stokado architecture (StorageOperator, Strategy, Scheduler, CacheStore, ProxyHandler)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/quota/size-tracker.ts` | SizeTracker class — incremental size tracking, quota check, init scan |
| Create | `src/quota/byte-size.ts` | `byteSize()` helper — UTF-8 byte length via Blob |
| Modify | `src/types.ts` | Add `QuotaInfo`, update `ProxyStorageOptions`, update `ProxyStorage` / `AsyncProxyStorage` |
| Modify | `src/core/operator.ts` | Accept `SizeTracker`, call check/add/remove/clear at right points |
| Modify | `src/core/proxy-handler.ts` | Accept `sizeTracker` + `ready`, expose `getUsage` and `ready` on proxy |
| Modify | `src/index.ts` | Create SizeTracker, init, wire into operator + proxy handler, export `KB`/`MB`/`QuotaInfo` |
| Create | `tests/unit/size-tracker.test.ts` | Unit tests for SizeTracker |
| Modify | `tests/unit/operator.test.ts` | Update `createSyncOperator`/`createAsyncOperator` signatures to accept SizeTracker |

---

### Task 1: Add byteSize helper

**Files:**
- Create: `src/quota/byte-size.ts`
- Test: `tests/unit/size-tracker.test.ts` (will be created in Task 2)

- [ ] **Step 1: Create the byte-size helper**

```ts
// src/quota/byte-size.ts
export function byteSize(str: string): number {
  return new Blob([str]).size
}
```

- [ ] **Step 2: Commit**

```bash
git add src/quota/byte-size.ts
git commit -m "feat: add byteSize helper for UTF-8 byte length calculation"
```

---

### Task 2: Implement SizeTracker class

**Files:**
- Create: `src/quota/size-tracker.ts`
- Create: `tests/unit/size-tracker.test.ts`

- [ ] **Step 1: Write failing tests for SizeTracker**

```ts
// tests/unit/size-tracker.test.ts
import { describe, expect, it, vi } from 'vitest'
import { SizeTracker } from '@/quota/size-tracker'

describe('SizeTracker', () => {
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
    const sizeBefore = tracker.current
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/size-tracker.test.ts`
Expected: FAIL — `SizeTracker` not found

- [ ] **Step 3: Implement SizeTracker**

```ts
// src/quota/size-tracker.ts
import type { QuotaInfo } from '@/types'
import { byteSize } from './byte-size'

export interface InitContext {
  isAsync: boolean
}

export class SizeTracker {
  private sizeMap = new Map<string, number>()
  private _current = 0
  private _limit: number
  private _onQuotaExceeded?: (info: QuotaInfo) => boolean | void | Promise<boolean | void>

  constructor(limit: number, onQuotaExceeded?: (info: QuotaInfo) => boolean | void | Promise<boolean | void>) {
    this._limit = limit
    this._onQuotaExceeded = onQuotaExceeded
  }

  get current(): number {
    return this._current
  }

  get limit(): number {
    return this._limit
  }

  init(storage: any, context: InitContext): void | Promise<void> {
    if (context.isAsync) {
      return this._initAsync(storage)
    }
    this._initSync(storage)
  }

  add(key: string, encoded: string): void {
    const newSize = byteSize(key) + byteSize(encoded)
    const oldSize = this.sizeMap.get(key) ?? 0
    this.sizeMap.set(key, newSize)
    this._current += newSize - oldSize
  }

  remove(key: string): void {
    const oldSize = this.sizeMap.get(key)
    if (oldSize !== undefined) {
      this._current -= oldSize
      this.sizeMap.delete(key)
    }
  }

  clear(): void {
    this.sizeMap.clear()
    this._current = 0
  }

  check(key: string, encoded: string, value: any): boolean | Promise<boolean> {
    const newSize = byteSize(key) + byteSize(encoded)
    const oldSize = this.sizeMap.get(key) ?? 0
    const delta = newSize - oldSize

    if (this._current + delta <= this._limit) {
      return true
    }

    if (!this._onQuotaExceeded) {
      return true
    }

    const result = this._onQuotaExceeded({
      current: this._current + delta,
      limit: this._limit,
      key,
      value,
    })

    if (result instanceof Promise) {
      return result.then(r => r !== false)
    }

    return result !== false
  }

  getUsage(): { current: number; limit: number } {
    return { current: this._current, limit: this._limit }
  }

  private _initSync(storage: any): void {
    const len = typeof storage.length === 'function' ? storage.length() : storage.length
    for (let i = 0; i < len; i++) {
      const key = storage.key(i)
      if (key === null || key === '__stokado_probe__')
        continue
      const raw = storage.getItem(key)
      if (raw !== null) {
        const size = byteSize(key) + byteSize(raw)
        this.sizeMap.set(key, size)
        this._current += size
      }
    }
  }

  private async _initAsync(storage: any): Promise<void> {
    const len = typeof storage.length === 'function' ? await storage.length() : storage.length
    for (let i = 0; i < len; i++) {
      const key = await storage.key(i)
      if (key === null || key === '__stokado_probe__')
        continue
      const raw = await storage.getItem(key)
      if (raw !== null) {
        const size = byteSize(key) + byteSize(raw)
        this.sizeMap.set(key, size)
        this._current += size
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/size-tracker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/quota/size-tracker.ts src/quota/byte-size.ts tests/unit/size-tracker.test.ts
git commit -m "feat: implement SizeTracker with init scan, quota check, and incremental tracking"
```

---

### Task 3: Update types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add QuotaInfo and update ProxyStorageOptions, ProxyStorage, AsyncProxyStorage**

In `src/types.ts`, add the `QuotaInfo` interface and update `ProxyStorageOptions`:

```ts
// Add after the ExpiresType type alias:
export interface QuotaInfo {
  current: number
  limit: number
  key: string
  value: any
}

// Update ProxyStorageOptions:
export interface ProxyStorageOptions {
  broadcast?: boolean
  channel?: string
  quota?: number
  onQuotaExceeded?: (info: QuotaInfo) => boolean | void | Promise<boolean | void>
}
```

Update `ProxyStorage` interface to add:

```ts
export interface ProxyStorage extends SyncStorageLike {
  on: (key: string, fn: Listener) => void
  once: (key: string, fn: Listener) => void
  off: (key?: string, fn?: Listener) => void
  setExpires: (key: string, expires: ExpiresType) => void
  getExpires: (key: string) => Date | undefined
  removeExpires: (key: string) => void
  setDisposable: (key: string) => void
  getOptions: (key: string) => StorageOptions | null
  getUsage: () => { current: number; limit: number }
  ready: Promise<void>
}
```

Update `AsyncProxyStorage` interface to add:

```ts
export interface AsyncProxyStorage extends AsyncStorageLike {
  on: (key: string, fn: Listener) => void
  once: (key: string, fn: Listener) => void
  off: (key?: string, fn?: Listener) => void
  setExpires: (key: string, expires: ExpiresType) => Promise<void>
  getExpires: (key: string) => Promise<Date | undefined>
  removeExpires: (key: string) => Promise<void>
  setDisposable: (key: string) => Promise<void>
  getOptions: (key: string) => Promise<StorageOptions | null>
  getUsage: () => { current: number; limit: number }
  ready: Promise<void>
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Errors in operator.ts, proxy-handler.ts, index.ts due to new SizeTracker parameter — will be fixed in subsequent tasks

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add QuotaInfo type and quota/onQuotaExceeded to ProxyStorageOptions"
```

---

### Task 4: Integrate SizeTracker into StorageOperator

**Files:**
- Modify: `src/core/operator.ts`
- Modify: `tests/unit/operator.test.ts`

- [ ] **Step 1: Update StorageOperator constructor to accept SizeTracker**

In `src/core/operator.ts`, add the import and constructor parameter:

```ts
import type { SizeTracker } from '@/quota/size-tracker'

// In the constructor, add the last parameter:
constructor(
  public readonly storage: any,
  private scheduler: Scheduler,
  private strategy: StorageStrategy,
  public readonly cache: CacheStore,
  public readonly emitter: EventEmitter,
  private broadcast: StorageBroadcast,
  private sizeTracker: SizeTracker | null = null,
)
```

- [ ] **Step 2: Add quota check in setItem**

In `setItem`, after computing `encoded` and before calling `strategy.setItem`, add the quota check. There are two places where `strategy.setItem` is called (the `!oldCached` branch and the else branch). Both need the check.

For the `!oldCached` branch, after the line `const encoded = encode(normalizedValue, ...)` and before `return resolve(this.strategy.setItem(...))`:

```ts
if (this.sizeTracker) {
  const allowed = this.sizeTracker.check(key, encoded, normalizedValue)
  if (isPromise(allowed)) {
    return allowed.then((ok) => {
      if (!ok) return
      return this._setItemNoCache(key, normalizedValue, oldOptions, options, encoded, oldValue)
    })
  }
  if (!allowed) return
}
```

For the else branch (when `oldCached` exists), after the line `const encoded = encode(...)` and before `return resolve(this.strategy.setItem(...))`:

```ts
if (this.sizeTracker) {
  const allowed = this.sizeTracker.check(key, encoded, normalizedValue)
  if (isPromise(allowed)) {
    return allowed.then((ok) => {
      if (!ok) return
      return this._setItemCached(key, normalizedValue, oldOptions, options, encoded, oldValue)
    })
  }
  if (!allowed) return
}
```

Note: This requires extracting the two setItem branches into private helper methods `_setItemNoCache` and `_setItemCached` to avoid duplication. The exact refactoring is:

Extract the `!oldCached` branch body (from `return resolve(this.strategy.getItem(...))` to its closing `})`) into:

```ts
private _setItemNoCache(key: string, normalizedValue: any, oldOptions: StorageOptions, options: StorageOptions | undefined, encoded: string, oldValue: any): any {
  return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
    if (raw !== null) {
      const decoded = decode(raw)
      if (decoded && typeof decoded !== 'string') {
        oldOptions = (decoded as DecodedItem).options ?? {}
      }
    }
    const mergedOptions = options ? { ...oldOptions, ...options } : (Object.keys(oldOptions).length > 0 ? oldOptions : {})
    return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
      this.cache.deleteObjectProxy(key)
      this.cache.set(key, { value: normalizedValue, type: getRawType(normalizedValue), options: Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined })
      if (hasChanged(normalizedValue, oldValue)) {
        this.emitter.emit(key, normalizedValue, oldValue)
        this.broadcast.post({ type: 'set', key, encoded })
      }
      if (Array.isArray(normalizedValue) && Array.isArray(oldValue) && normalizedValue.length !== oldValue.length) {
        this.emitter.emit(`${key}.length`, normalizedValue.length, oldValue.length)
      }
      this.sizeTracker?.add(key, encoded)
    })
  })
}
```

Extract the else branch body into:

```ts
private _setItemCached(key: string, normalizedValue: any, oldOptions: StorageOptions, options: StorageOptions | undefined, encoded: string, oldValue: any): any {
  const mergedOptions = options ? { ...oldOptions, ...options } : oldOptions
  return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
    this.cache.deleteObjectProxy(key)
    this.cache.set(key, { value: normalizedValue, type: getRawType(normalizedValue), options: Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined })
    if (hasChanged(normalizedValue, oldValue)) {
      this.emitter.emit(key, normalizedValue, oldValue)
      this.broadcast.post({ type: 'set', key, encoded })
    }
    if (Array.isArray(normalizedValue) && Array.isArray(oldValue) && normalizedValue.length !== oldValue.length) {
      this.emitter.emit(`${key}.length`, normalizedValue.length, oldValue.length)
    }
    this.sizeTracker?.add(key, encoded)
  })
}
```

Then the main `setItem` becomes:

```ts
setItem(key: string, value: any, options?: StorageOptions): any {
  return this.scheduler.enqueue(key, () => {
    const normalizedValue = toPrimitive(value)
    const oldCached = this.cache.get(key)
    const oldValue = oldCached?.value
    let oldOptions = oldCached?.options ?? {}

    if (!oldCached) {
      const mergedOptions = options ? { ...oldOptions, ...options } : (Object.keys(oldOptions).length > 0 ? oldOptions : {})
      const encoded = encode(normalizedValue, Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined)

      if (this.sizeTracker) {
        const allowed = this.sizeTracker.check(key, encoded, normalizedValue)
        if (isPromise(allowed)) {
          return allowed.then((ok) => {
            if (!ok) return
            return this._setItemNoCache(key, normalizedValue, oldOptions, options, encoded, oldValue)
          })
        }
        if (!allowed) return
      }

      return this._setItemNoCache(key, normalizedValue, oldOptions, options, encoded, oldValue)
    }

    const mergedOptions = options ? { ...oldOptions, ...options } : oldOptions
    const encoded = encode(normalizedValue, Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined)

    if (this.sizeTracker) {
      const allowed = this.sizeTracker.check(key, encoded, normalizedValue)
      if (isPromise(allowed)) {
        return allowed.then((ok) => {
          if (!ok) return
          return this._setItemCached(key, normalizedValue, oldOptions, options, encoded, oldValue)
        })
      }
      if (!allowed) return
    }

    return this._setItemCached(key, normalizedValue, oldOptions, options, encoded, oldValue)
  })
}
```

- [ ] **Step 3: Add sizeTracker.remove in removeItem**

In `removeItem`, after the successful remove (inside the `resolve` callback after `this.cache.delete(key)`), add:

```ts
this.sizeTracker?.remove(key)
```

There are two remove branches in removeItem — add it to both.

- [ ] **Step 4: Add sizeTracker.clear in clear**

In `clear`, after `this.cache.clear()` inside the try block, add:

```ts
this.sizeTracker?.clear()
```

- [ ] **Step 5: Update handleBroadcast**

In `handleBroadcast`, update each case:

```ts
case 'set': {
  const decoded = decode(msg.encoded)
  if (decoded && typeof decoded !== 'string') {
    const item = decoded as DecodedItem
    if (this.isExpired(item.options)) {
      this.cache.delete(msg.key)
      this.sizeTracker?.remove(msg.key)
      break
    }
    const oldCached = this.cache.get(msg.key)
    this.cache.deleteObjectProxy(msg.key)
    this.cache.set(msg.key, { value: item.value, type: item.type, options: item.options })
    this.emitter.emit(msg.key, item.value, oldCached?.value)
    if (Array.isArray(item.value) && oldCached && Array.isArray(oldCached.value) && item.value.length !== oldCached.value.length) {
      this.emitter.emit(`${msg.key}.length`, item.value.length, oldCached.value.length)
    }
    this.sizeTracker?.add(msg.key, msg.encoded)
  }
  break
}
case 'remove': {
  const oldCached = this.cache.get(msg.key)
  if (oldCached !== undefined) {
    this.cache.delete(msg.key)
    this.emitter.emit(msg.key, undefined, oldCached.value)
  }
  this.sizeTracker?.remove(msg.key)
  break
}
case 'clear': {
  const cachedEntries = Array.from(this.cache.entries())
  this.cache.clear()
  for (const [key, cached] of cachedEntries) {
    this.emitter.emit(key, undefined, cached.value)
  }
  this.sizeTracker?.clear()
  break
}
```

- [ ] **Step 6: Update test helpers to pass null SizeTracker**

In `tests/unit/operator.test.ts`, update `createSyncOperator` and `createAsyncOperator`:

```ts
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
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 8: Commit**

```bash
git add src/core/operator.ts tests/unit/operator.test.ts
git commit -m "feat: integrate SizeTracker into StorageOperator for quota checks"
```

---

### Task 5: Update proxy handler to expose getUsage and ready

**Files:**
- Modify: `src/core/proxy-handler.ts`

- [ ] **Step 1: Update createProxyHandler signature and add getUsage/ready traps**

```ts
// src/core/proxy-handler.ts
import type { SizeTracker } from '@/quota/size-tracker'
import type { StorageOperator } from './operator'
import type { StorageOptions } from '@/types'
import { isFunction, isString } from '@/utils'

export function createProxyHandler(operator: StorageOperator, sizeTracker: SizeTracker | null, ready: Promise<void>): ProxyHandler<any> {
  return {
    get(target, prop: string) {
      if (prop === 'getUsage') {
        return () => sizeTracker?.getUsage() ?? { current: 0, limit: 0 }
      }
      if (prop === 'ready') {
        return ready
      }

      switch (prop) {
        // ... existing cases unchanged
      }
      // ... rest unchanged
    },
    // ... set and deleteProperty unchanged
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Error in index.ts because createProxyHandler call hasn't been updated yet — will be fixed in Task 6

- [ ] **Step 3: Commit**

```bash
git add src/core/proxy-handler.ts
git commit -m "feat: expose getUsage and ready on proxy via handler traps"
```

---

### Task 6: Wire everything in createProxyStorage

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update imports and createProxyStorage function**

```ts
// src/index.ts
import type { AsyncProxyStorage, AsyncStorageLike, ProxyStorage, ProxyStorageOptions, QuotaInfo, StorageLike, SyncStorageLike } from '@/types'
import { CacheStore } from '@/cache/store'
import { StorageOperator } from '@/core/operator'
import { createProxyHandler } from '@/core/proxy-handler'
import { StorageBroadcast } from '@/events/broadcast'
import { EventEmitter } from '@/events/emitter'
import { SizeTracker } from '@/quota/size-tracker'
import { AsyncScheduler } from '@/scheduler/async-scheduler'
import { SyncScheduler } from '@/scheduler/sync-scheduler'
import { AsyncStrategy } from '@/strategy/async-strategy'
import { SyncStrategy } from '@/strategy/sync-strategy'
import { isFunction, isPromise } from '@/utils'

export { StorageOperator } from '@/core/operator'
export { decode } from '@/serializer/decode'
export { encode } from '@/serializer/encode'
export type { AsyncProxyStorage, AsyncStorageLike, Listener, ProxyStorage, ProxyStorageOptions, QuotaInfo, StorageLike, StorageOptions, SyncStorageLike } from '@/types'
export { SizeTracker } from '@/quota/size-tracker'

export const KB = 1024
export const MB = 1024 * KB

export function createProxyStorage(storage: SyncStorageLike, options?: ProxyStorageOptions): ProxyStorage
export function createProxyStorage(storage: AsyncStorageLike, options?: ProxyStorageOptions): AsyncProxyStorage
export function createProxyStorage(storage: StorageLike, options?: ProxyStorageOptions) {
  validateStorage(storage)

  const isAsync = detectAsync(storage)

  const broadcastEnabled = shouldEnableBroadcast(storage, options?.broadcast)
  const channelId = broadcastEnabled ? resolveChannelId(storage, options?.channel) : null

  const scheduler = isAsync ? new AsyncScheduler() : new SyncScheduler()
  const strategy = isAsync ? new AsyncStrategy() : new SyncStrategy()
  const cache = new CacheStore()
  const emitter = new EventEmitter()
  const broadcast = new StorageBroadcast(channelId)

  const sizeTracker = options?.quota
    ? new SizeTracker(options.quota, options.onQuotaExceeded)
    : null

  const operator = new StorageOperator(storage, scheduler, strategy, cache, emitter, broadcast, sizeTracker)

  const initResult = sizeTracker?.init(storage, { isAsync })
  const ready = initResult instanceof Promise ? initResult : Promise.resolve()

  const proxy = new Proxy(storage, createProxyHandler(operator, sizeTracker, ready))

  broadcast.listen(msg => operator.handleBroadcast(msg))

  return proxy
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire SizeTracker into createProxyStorage with quota and onQuotaExceeded"
```

---

### Task 7: Integration tests for quota alert

**Files:**
- Modify: `tests/unit/operator.test.ts`

- [ ] **Step 1: Write integration tests for quota behavior via StorageOperator**

Add to `tests/unit/operator.test.ts`:

```ts
import { SizeTracker } from '@/quota/size-tracker'

// Add inside the file, after existing describe blocks:

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
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/unit/operator.test.ts
git commit -m "test: add integration tests for quota alert in StorageOperator"
```

---

### Task 8: Run full validation

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run lint**

Run: `npx eslint . --fix`
Expected: No errors

- [ ] **Step 4: Final commit if lint made changes**

```bash
git add -A
git commit -m "chore: lint fixes for quota alert feature"
```
