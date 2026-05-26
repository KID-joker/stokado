# Stokado Architecture Refactor Design

## Overview

Refactor the internal architecture of Stokado with an updated public API (`createProxyStorage(storage, options?)`) and all current functionality. The goal is to establish clear separation of concerns, eliminate global mutable state, resolve the async operation ordering problem, and improve testability.

## Design Decisions

| Concern | Decision |
|---------|----------|
| Async operation queue | Per-key independent queues; same-key operations execute strictly in call order |
| Cross-key operations | `clear()` waits for all active queues to drain before executing |
| Sync/Async architecture | Unified core with Strategy pattern (SyncStrategy / AsyncStrategy) |
| External API | `createProxyStorage(storage, options?)` — second parameter changed from `name?: string` to `options?: ProxyStorageOptions` (see API Changes section) |
| Nested object proxy | Behavior unchanged; sub-property mutations re-serialize the entire parent object |
| Refactoring scope | Core architecture + code smell removal + unit test additions |
| Testing strategy | Keep existing Playwright E2E tests + add vitest unit tests |
| Missing/expired/disposed key return value | `getItem()` returns `null`; property access (`proxy.key`) returns `undefined` — consistent with native Storage API |
| `length` property | Type-check `storage.length`: if function, call `length()`; otherwise return property value directly |
| Broadcast emission (setItem) | Only broadcast when value has actually changed (`hasChanged` check) |
| Broadcast emission (onObjectPropertySet) | Always broadcast — object was mutated in place, `hasChanged` is unreliable for reference types |
| `removeItem` event | Only emit event and broadcast when the key exists — consistent with `handleBroadcast` behavior |
| `clear()` event | Emit per-key events for all cached keys (`emit(key, undefined, oldValue)`) before clearing; also broadcast `type: 'clear'` |
| Broadcast | Unified channel `stokado::channel`; controlled by `options.broadcast` (default `true`); auto-disabled for `sessionStorage`; `options.channel` provides storage identifier for message filtering; auto-detected as `'localStorage'` for `localStorage` |

## Module Structure

```
src/
├── index.ts                    # Entry point, exports createProxyStorage
├── types.ts                    # All type definitions
│
├── core/
│   ├── operator.ts             # StorageOperator — orchestrates high-level operations (includes expires/disposable/options logic)
│   ├── proxy-handler.ts        # Proxy get/set/deleteProperty handler
│   └── proxy-object.ts         # Nested object/array Proxy handler
│
├── scheduler/
│   ├── types.ts                # Scheduler interface
│   ├── sync-scheduler.ts       # SyncScheduler — direct execution, no queue
│   └── async-scheduler.ts      # AsyncScheduler — per-key queue scheduling
│
├── strategy/
│   ├── types.ts                # StorageStrategy interface
│   ├── sync-strategy.ts        # SyncStrategy — synchronous I/O
│   └── async-strategy.ts       # AsyncStrategy — Promise-based I/O
│
├── serializer/
│   ├── encode.ts               # Encode (value → storage string)
│   ├── decode.ts               # Decode (storage string → value)
│   └── registry.ts             # Type serializer registry
│
├── cache/
│   └── store.ts                # CacheStore — instance-level cache management
│
├── events/
│   ├── emitter.ts              # Event subscription/emission (on/off/once/emit)
│   └── broadcast.ts            # Cross-tab BroadcastChannel sync
│
└── utils.ts                    # Utility functions (isPromise, resolve, formatTime, etc.)
```

### Dependency Direction (Acyclic)

```
index → core/operator
core/operator → scheduler, strategy, serializer, cache, events
core/proxy-handler → core/operator
core/proxy-object → core/operator
scheduler → (no external deps)
strategy → (no external deps)
serializer → utils (getRawType)
cache → types (StorageOptions)
events → (no external deps)
```

Key change: The circular dependency between `transform.ts` and `object.ts` is eliminated. The serializer performs pure data transformation only; Proxy creation is handled by the Operator in `getItem`.

### Types (`types.ts`)

The `StorageLike` interface is split into `SyncStorageLike` and `AsyncStorageLike` for better type safety:

```ts
export interface SyncStorageLike {
  [x: string]: any
  clear: () => void
  getItem: (key: string) => string | null
  key: (key: number) => string | null
  setItem: (key: string, value: any, options?: StorageOptions) => void
  removeItem: (key: string) => void
  length: number
}

export interface AsyncStorageLike {
  [x: string]: any
  clear: () => Promise<void>
  getItem: (key: string) => Promise<string | null>
  key: (key: number) => Promise<string | null>
  setItem: (key: string, value: any, options?: StorageOptions) => Promise<void>
  removeItem: (key: string) => Promise<void>
  length: () => Promise<number>
}

export type StorageLike = SyncStorageLike | AsyncStorageLike

export interface ProxyStorage extends SyncStorageLike {
  on: (key: string, fn: Listener) => void
  once: (key: string, fn: Listener) => void
  off: (key?: string, fn?: Listener) => void
  setExpires: (key: string, expires: ExpiresType) => void
  getExpires: (key: string) => Date | undefined
  removeExpires: (key: string) => void
  setDisposable: (key: string) => void
  getOptions: (key: string) => StorageOptions | null
}

export interface AsyncProxyStorage extends AsyncStorageLike {
  on: (key: string, fn: Listener) => void
  once: (key: string, fn: Listener) => void
  off: (key?: string, fn?: Listener) => void
  setExpires: (key: string, expires: ExpiresType) => Promise<void>
  getExpires: (key: string) => Promise<Date | undefined>
  removeExpires: (key: string) => Promise<void>
  setDisposable: (key: string) => Promise<void>
  getOptions: (key: string) => Promise<StorageOptions | null>
}

export type Listener = (newValue: any, oldValue: any) => void
```

## Scheduler

### Interface

```ts
interface Scheduler {
  readonly isAsync: boolean

  enqueue: <T>(key: string, operation: () => T | Promise<T>) => T | Promise<T>

  flush: (key: string) => void | Promise<void>

  flushAll: () => void | Promise<void>
}
```

### SyncScheduler

Direct execution with zero overhead:

```ts
class SyncScheduler implements Scheduler {
  readonly isAsync = false
  enqueue<T>(key: string, operation: () => T): T {
    return operation()
  }

  flush(_key: string): void {}
  flushAll(): void {}
}
```

### AsyncScheduler

Per-key promise chain with automatic cleanup and error isolation:

```ts
class AsyncScheduler implements Scheduler {
  readonly isAsync = true
  private queues = new Map<string, Promise<any>>()

  enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(key) ?? Promise.resolve()
    const next = prev.then(() => operation()).then(
      (result) => {
        if (this.queues.get(key) === next)
          this.queues.delete(key)
        return result
      },
      (error) => {
        if (this.queues.get(key) === next)
          this.queues.delete(key)
        throw error
      }
    )
    this.queues.set(key, next)
    return next
  }

  flush(key: string): Promise<void> {
    return (this.queues.get(key) ?? Promise.resolve()).then(() => {})
  }

  flushAll(): Promise<void> {
    const pending = Array.from(this.queues.values())
    return Promise.all(pending).then(() => {})
  }
}
```

### Behavioral Guarantees

| Scenario | Behavior |
|----------|----------|
| `removeItem('a')` then `getItem('a')` | Same key queue; getItem executes after removeItem fully completes; returns null |
| `setItem('a', 1)` and `setItem('b', 2)` | Different keys; may execute in parallel |
| `clear()` | Calls `flushAll()` first, then executes the actual clear |
| Error in one operation | Does not block subsequent operations on the same key; queue auto-recovers |
| Memory management | Idle queues are removed from the Map; no reference to completed Promises |

## Strategy

### Interface

```ts
interface StorageStrategy {
  getItem: (storage: StorageLike, key: string) => string | null | Promise<string | null>
  setItem: (storage: StorageLike, key: string, value: string) => void | Promise<void>
  removeItem: (storage: StorageLike, key: string) => void | Promise<void>
  clear: (storage: StorageLike) => void | Promise<void>
  length: (storage: StorageLike) => number | Promise<number>
  key: (storage: StorageLike, index: number) => string | null | Promise<string | null>
}
```

### SyncStrategy

Directly calls the underlying storage methods and returns synchronous values.

### AsyncStrategy

Wraps each call with `await` and returns Promises.

### `length` Property vs Method Handling

The `length` property behaves differently between sync and async storage backends:

- **Sync storage** (localStorage/sessionStorage): `length` is a plain property → `storage.length` returns a number
- **Async storage** (localForage/IndexedDB): `length` is a method → `storage.length()` returns a `Promise<number>`

The Strategy layer handles this transparently:

```ts
// SyncStrategy
length(storage: StorageLike): number {
  return typeof storage.length === 'function' ? storage.length() : storage.length
}

// AsyncStrategy
async length(storage: StorageLike): Promise<number> {
  return typeof storage.length === 'function' ? await storage.length() : storage.length
}
```

The ProxyHandler's `get` trap for `'length'` performs a type check on `storage.length`: if it is a function, returns `() => operator.length` (so `proxy.length()` works for async storage); otherwise returns `operator.length` directly (so `proxy.length` works for sync storage). This preserves the existing behavior where async storage uses `proxy.length()` and sync storage uses `proxy.length`.

```ts
// proxy-handler.ts
case 'length': {
  const len = target.length
  return typeof len === 'function'
    ? () => operator.length
    : operator.length
}
```

### Auto-detection

```ts
function detectAsync(storage: StorageLike): boolean {
  const probe = storage.getItem('__stokado_probe__')
  return isPromise(probe)
}
```

### Collaboration Between Strategy and Scheduler

```
External call: proxy.test = 'hello'
  → ProxyHandler.set('test', 'hello')
  → operator.setItem('test', 'hello')
  → scheduler.enqueue('test', () => {
      const encoded = encode('hello')          // pure computation, no I/O
      strategy.setItem(storage, 'test', encoded) // actual I/O
      cache.set('test', decoded)                // update cache
      emitter.emit('test', 'hello', oldValue)  // fire events (only if hasChanged)
      broadcast.post({ type: 'set', ... })      // broadcast (only if hasChanged)
    })
  → Sync: lambda executes immediately, returns synchronously
  → Async: appended to key='test' queue, returns Promise
```

All steps within `enqueue`'s operation (serialization, I/O, cache update, event emission) form an atomic unit — no other operation on the same key can interleave.

## StorageOperator

The central orchestrator that composes Scheduler, Strategy, Serializer, Cache, and Emitter.

```ts
class StorageOperator {
  private channelId: string | null

  constructor(
    private storage: StorageLike,
    private scheduler: Scheduler,
    private strategy: StorageStrategy,
    private cache: CacheStore,
    private emitter: EventEmitter,
    private broadcast: StorageBroadcast,
    channelId?: string | null,
  ) {
    this.channelId = channelId ?? null
  }

  get isAsync(): boolean

  // --- Core operations ---
  getItem(key: string): any | Promise<any>
  setItem(key: string, value: any, options?: StorageOptions): void | Promise<void>
  removeItem(key: string): void | Promise<void>
  clear(): void | Promise<void>
  key(index: number): string | null | Promise<string | null>
  get length(): number | Promise<number>

  // --- Extended operations ---
  setExpires(key: string, expires: number | Date): void | Promise<void>
  getExpires(key: string): Date | undefined | Promise<Date | undefined>
  removeExpires(key: string): void | Promise<void>
  setDisposable(key: string): void | Promise<void>
  getOptions(key: string): StorageOptions | null | Promise<StorageOptions | null>

  // --- Nested object support ---
  createObjectProxy(key: string, rawValue: object): object
  onObjectPropertySet(key: string, fullValue: object): void | Promise<void>

  // --- Broadcast handling ---
  handleBroadcast(msg: BroadcastMessage): void
}
```

### `isAsync` Detection

The `isAsync` getter uses the Scheduler's `readonly isAsync` flag:

```ts
get isAsync(): boolean {
  return this.scheduler.isAsync
}
```

### Internal Flow: getItem

`getItem` returns `null` for missing, expired, and disposed keys — consistent with the native `Storage.getItem()` API. The ProxyHandler converts `null` to `undefined` for property access (`proxy.key`), matching the native `storage.key` behavior.

```ts
getItem(key: string) {
  return this.scheduler.enqueue(key, () => {
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      if (this.isExpired(cached.options)) {
        return resolve(this.strategy.removeItem(this.storage, key), () => {
          this.cache.delete(key)
          return null
        })
      }
      if (cached.options?.disposable) {
        return resolve(this.strategy.removeItem(this.storage, key), () => {
          this.cache.delete(key)
          return this.extractValue(cached, key)
        })
      }
      return this.extractValue(cached, key)
    }

    return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
      if (raw === null) return null

      const decoded = decode(raw)
      if (decoded === null || typeof decoded === 'string') return decoded

      const item = decoded as DecodedItem
      this.cache.set(key, { value: item.value, type: item.type, options: item.options })

      if (this.isExpired(item.options)) {
        return resolve(this.strategy.removeItem(this.storage, key), () => {
          this.cache.delete(key)
          return null
        })
      }

      if (item.options?.disposable) {
        return resolve(this.strategy.removeItem(this.storage, key), () => {
          this.cache.delete(key)
          return this.wrapIfObject(item, key)
        })
      }

      return this.wrapIfObject(item, key)
    })
  })
}
```

### Internal Flow: setItem

Broadcast and event emission only occur when the value has actually changed:

```ts
setItem(key: string, value: any, options?: StorageOptions) {
  return this.scheduler.enqueue(key, () => {
    const oldCached = this.cache.get(key)
    const oldValue = oldCached?.value
    const oldOptions = oldCached?.options ?? {}
    const mergedOptions = options ? { ...oldOptions, ...options } : oldOptions
    const encoded = encode(value, Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined)

    return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
      this.cache.deleteObjectProxy(key)
      this.cache.set(key, { value, type: getRawType(value), options: Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined })
      if (hasChanged(value, oldValue)) {
        this.emitter.emit(key, value, oldValue)
        this.broadcast.post({ type: 'set', key, encoded, channel: this.channelId ?? undefined })
      }

      if (Array.isArray(value) && Array.isArray(oldValue) && value.length !== oldValue.length) {
        this.emitter.emit(`${key}.length`, value.length, oldValue.length)
      }

      // Note: when oldValue is undefined (new key), no length event is emitted.
      // This is intentional — the transition from undefined to an array is a key-level
      // change, not a length change. Listeners should subscribe to the key itself.
    })
  })
}
```

### Internal Flow: removeItem

Only emits events and broadcasts on `removeItem` when the key exists. For keys not in cache, the storage is checked first to determine existence. This is consistent with the `handleBroadcast` behavior for `'remove'` messages — only notify listeners when the key actually existed.

```ts
removeItem(key: string) {
  return this.scheduler.enqueue(key, () => {
    const oldCached = this.cache.get(key)

    if (oldCached !== undefined) {
      const oldValue = oldCached.value
      return resolve(this.strategy.removeItem(this.storage, key), () => {
        this.cache.delete(key)
        this.emitter.emit(key, undefined, oldValue)
        this.broadcast.post({ type: 'remove', key, channel: this.channelId ?? undefined })
      })
    }

    return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
      if (raw === null) return

      return resolve(this.strategy.removeItem(this.storage, key), () => {
        this.cache.delete(key)
        const decoded = decode(raw)
        const item = typeof decoded !== 'string' && decoded !== null ? decoded as DecodedItem : null
        const oldValue = item?.value ?? raw
        this.emitter.emit(key, undefined, oldValue)
        this.broadcast.post({ type: 'remove', key, channel: this.channelId ?? undefined })
      })
    })
  })
}
```

### Internal Flow: clear

`clear()` emits per-key events for all cached keys before clearing. After `flushAll()` drains all active queues, the cache entries are snapshot, then the storage is cleared, and each cached key receives an `emit(key, undefined, oldValue)` event. This ensures listeners are notified when their observed keys are removed by `clear()`.

```ts
clear() {
  const doFlush = this.scheduler.flushAll()
  return resolve(doFlush, () => {
    const cachedEntries = Array.from(this.cache.entries())
    return resolve(this.strategy.clear(this.storage), () => {
      this.cache.clear()
      for (const [key, cached] of cachedEntries) {
        this.emitter.emit(key, undefined, cached.value)
      }
      this.broadcast.post({ type: 'clear', channel: this.channelId ?? undefined })
    })
  })
}
```

### `clear()` Concurrency Semantics

`clear()` calls `flushAll()` to wait for all currently active queues to drain, then executes the actual clear. New operations enqueued during the `flushAll()` wait will execute after `clear()` completes. This is intentional — a `setItem` call made after `clear()` should persist:

```
Timeline:
  t1: setItem('a', '1')     → enqueued on key 'a'
  t2: clear()               → flushAll() waits for 'a' to complete
  t3: setItem('b', '2')     → enqueued on key 'b' (during flushAll wait)
  t4: flushAll resolves     → all prior operations done
  t5: clear executes        → storage is cleared, cache is cleared
  t6: setItem('b') executes → 'b' = '2' exists after clear
```

### The `resolve` Helper

A lightweight utility that avoids dual code paths:

```ts
function resolve<T, R>(val: T | Promise<T>, fn: (v: T) => R | Promise<R>): R | Promise<R> {
  if (isPromise(val))
    return val.then(fn)
  return fn(val)
}
```

This replaces the old `pThen` pattern. Key difference: no global state, no promise chain accumulation.

## CacheStore

Instance-level cache, created per `createProxyStorage` call. No global WeakMaps.

```ts
interface CachedItem {
  value: any
  type: string
  options?: StorageOptions
}

class CacheStore {
  private items = new Map<string, CachedItem>()
  private objectProxies = new Map<string, object>()

  get(key: string): CachedItem | undefined
  set(key: string, item: CachedItem): void
  delete(key: string): void
  has(key: string): boolean
  entries(): IterableIterator<[string, CachedItem]>
  clear(): void

  getObjectProxy(key: string): object | undefined
  setObjectProxy(key: string, proxy: object): void
  deleteObjectProxy(key: string): void
}
```

## EventEmitter

Instance-level event system with key-granularity subscriptions.

```ts
type Listener = (newValue: any, oldValue: any) => void

interface WrappedListener {
  fn: Listener
  originalFn?: Listener
}

class EventEmitter {
  private listeners = new Map<string, WrappedListener[]>()

  on(key: string, fn: Listener): void
  once(key: string, fn: Listener): void
  off(key: string, fn?: Listener): void
  offAll(): void
  emit(key: string, newValue: any, oldValue: any): void
  getRegisteredKeys(): string[]
}
```

`emit` is a pure notification mechanism — it always fires when called, with no `hasChanged` check inside. The decision of "has this value changed?" is the caller's responsibility. This follows the same pattern as MobX (property-level notification) and Svelte (manual `set()` calls): the code that knows the context decides whether to notify.

`emit` uses snapshot iteration (`[...list]`) to safely handle listeners that call `off` during execution (e.g., `once` handlers). This ensures all listeners registered at the time of `emit` are called exactly once, regardless of mutations to the listener list during iteration.

### Event Emission Rules

| Trigger | Events Emitted |
|---------|---------------|
| `storage.name = 'x'` | `hasChanged('x', oldValue)` → `emit('name', 'x', oldValue)` + `broadcast.post(...)` |
| `storage.user.age = 18` | `emit('user', user, user)` (always, from `onObjectPropertySet`) + `hasChanged(18, oldAge)` → `emit('user.age', 18, oldAge)` |
| `storage.list.push(item)` | `emit('list', list, list)` (always) + `emit('list.length', newLen, oldLen)` |
| `storage.list.sort()` | `emit('list', list, list)` (always) — no length event (length unchanged) |
| `delete storage.name` | `emit('name', undefined, oldValue)` only if key exists; no event if key does not exist |
| `storage.clear()` | `emit(key, undefined, oldValue)` for each cached key + `broadcast.post({ type: 'clear' })` |

**Broadcast strategy distinction:**
- `setItem`: broadcast only when `hasChanged(newValue, oldValue)` — value replacement is detectable
- `onObjectPropertySet`: always broadcast — object was mutated in place, `hasChanged` is unreliable for reference types

## StorageBroadcast

Cross-tab synchronization via a unified BroadcastChannel (`stokado::channel`). Only active when broadcast is enabled (see Entry Point Assembly for enablement logic). Messages include an optional `channel` field for storage instance identification — when both sender and receiver have a channel ID, messages are filtered to avoid cross-storage pollution.

```ts
type BroadcastMessage
  = | { type: 'set', key: string, encoded: string, channel?: string }
    | { type: 'remove', key: string, channel?: string }
    | { type: 'clear', channel?: string }

class StorageBroadcast {
  private channel: BroadcastChannel | null = null
  private channelId: string | null

  constructor(channelId: string | null)
  post(message: BroadcastMessage): void
  listen(onMessage: (msg: BroadcastMessage) => void): void
  destroy(): void
}
```

All stokado instances share the same `BroadcastChannel('stokado::channel')`. The `channelId` is used for message filtering:
- When posting, `channelId` is included in the `channel` field of the message
- When receiving, if both the local `channelId` and the message's `channel` are present and differ, the message is ignored
- If either side lacks a `channelId`, the message is always processed (backward-compatible for single-storage apps)

Incoming broadcast messages bypass the Scheduler (the actual storage I/O was already performed by the sender). They directly update the cache and trigger emitter events.

When handling a `'set'` broadcast for a key that previously had an object proxy, the old proxy is invalidated (`cache.deleteObjectProxy(key)`) and the cache is updated with the new decoded value. The next `getItem` call for that key will create a fresh object proxy. This ensures that code holding stale proxy references from before the broadcast will not produce inconsistent writes — the `onObjectPropertySet` flow checks cache before writing back, and will skip if the key has been removed from cache by the broadcast handler.

### Broadcast Expiration Check

When handling a `'set'` broadcast, the operator checks whether the incoming data is expired. If expired, the key is removed from cache and no event is emitted. For non-expired data, the event is emitted unconditionally (no `hasChanged` check) because the sender already determined the value changed, and the receiver should always be notified of cross-tab updates:

```ts
handleBroadcast(msg: BroadcastMessage): void {
  if (this.channelId && msg.channel && this.channelId !== msg.channel) return

  switch (msg.type) {
    case 'set': {
      const decoded = decode(msg.encoded)
      if (decoded && typeof decoded !== 'string') {
        const item = decoded as DecodedItem
        if (this.isExpired(item.options)) {
          this.cache.delete(msg.key)
          break
        }
        const oldCached = this.cache.get(msg.key)
        this.cache.deleteObjectProxy(msg.key)
        this.cache.set(msg.key, { value: item.value, type: item.type, options: item.options })
        this.emitter.emit(msg.key, item.value, oldCached?.value)
      }
      break
    }
    case 'remove': {
      const oldCached = this.cache.get(msg.key)
      if (oldCached !== undefined) {
        this.cache.delete(msg.key)
        this.emitter.emit(msg.key, undefined, oldCached.value)
      }
      break
    }
    case 'clear': {
      const cachedEntries = Array.from(this.cache.entries())
      this.cache.clear()
      for (const [key, cached] of cachedEntries) {
        this.emitter.emit(key, undefined, cached.value)
      }
      break
    }
  }
}
```

> **Note:** The `'remove'` handler only emits events when the key was in the local cache, consistent with `removeItem`'s behavior of only emitting for existing keys. The `'clear'` handler emits per-key events for all cached keys, consistent with `clear()`'s behavior.

## ProxyHandler

Translates property access into Operator calls.

### Return Value Convention

- `operator.getItem()` returns `null` for missing/expired/disposed keys (consistent with `Storage.getItem()`)
- Property access (`proxy.key`) converts `null` to `undefined` (consistent with `storage.key`)
- Method access (`proxy.getItem('key')`) returns `null` as-is

```ts
function createProxyHandler(operator: StorageOperator): ProxyHandler<StorageLike> {
  return {
    get(target, prop: string) {
      // 1. Standard Storage interface methods
      switch (prop) {
        case 'getItem':
          return (key: string) => operator.getItem(key)
        case 'setItem':
          return (key: string, value: any, options?: StorageOptions) => operator.setItem(key, value, options)
        case 'removeItem':
          return (key: string) => operator.removeItem(key)
        case 'clear':
          return () => operator.clear()
        case 'key':
          return (index: number) => operator.key(index)
        case 'length': {
          const len = target.length
          return typeof len === 'function'
            ? () => operator.length
            : operator.length
        }
      }

      // 2. Extended methods
      switch (prop) {
        case 'on':
          return (key: string, fn: any) => operator.emitter.on(key, fn)
        case 'once':
          return (key: string, fn: any) => operator.emitter.once(key, fn)
        case 'off':
          return (key?: string, fn?: any) => {
            if (key === undefined) {
              operator.emitter.offAll()
            }
            else {
              operator.emitter.off(key, fn)
            }
          }
        case 'setExpires':
          return (key: string, expires: any) => operator.setExpires(key, expires)
        case 'getExpires':
          return (key: string) => operator.getExpires(key)
        case 'removeExpires':
          return (key: string) => operator.removeExpires(key)
        case 'setDisposable':
          return (key: string) => operator.setDisposable(key)
        case 'getOptions':
          return (key: string) => operator.getOptions(key)
      }

      // 3. Native storage properties that aren't keys
      const nativeValue = target[prop]
      if (nativeValue !== undefined && !isString(nativeValue)) {
        return isFunction(nativeValue) ? nativeValue.bind(target) : nativeValue
      }

      // 4. Property access → getItem, convert null → undefined
      const result = operator.getItem(prop)
      if (operator.isAsync) {
        return result.then((v: any) => v === null ? undefined : v)
      }
      return result === null ? undefined : result
    },

    set(_target, prop: string, value) {
      operator.setItem(prop, value)
      return true
    },

    deleteProperty(_target, prop: string) {
      operator.removeItem(prop)
      return true
    },
  }
}
```

## Nested Object Proxy

When `getItem` decodes an Object or Array type, it wraps the value in a nested Proxy.

```ts
function createObjectProxy(
  rawValue: object,
  key: string,
  operator: StorageOperator
): object
```

Behavior:
- **Property set** (`obj.prop = val`): mutates the raw object, then calls `operator.onObjectPropertySet(key, obj)` to re-serialize and write back. For array index sets (e.g., `arr[0] = 'x'`), `isIntegerKey` is used to detect integer keys and format sub-key events as `key[0]` instead of `key.0`. `onObjectPropertySet` calls `emit(key, target, target)` unconditionally (no `hasChanged` check, since the object was mutated in place and `Object.is` would incorrectly return `true`). Broadcast is also unconditional for the same reason — since `hasChanged(obj, obj)` is always `false` for the same reference, the sender cannot determine whether the mutation actually changed any sub-property, so it must always broadcast to ensure other tabs stay in sync.
- **Array mutations** (`push/pop/shift/unshift/splice`): mutates the array, then triggers re-serialization + length change events. Parent event emitted unconditionally from `onObjectPropertySet`. Uses `try/finally` to ensure the `mutating` flag is always reset, even if the mutation throws.
- **Array mutations** (`sort/reverse`): mutates the array, then triggers re-serialization (no length change event since length is unchanged). Parent event emitted unconditionally. Also uses `try/finally`.

> **Note:** `sort`/`reverse` interception is a feature enhancement over the previous version, which only supported `push/pop/shift/unshift/splice`. It is included in this refactor because the `try/finally` safety mechanism naturally covers all mutation methods.

- **Property delete**: removes from raw object, triggers re-serialization. Parent event emitted unconditionally.

Reference stability is guaranteed: `storage.obj === storage.obj` returns `true` because `CacheStore` caches the proxy instance.

### `mutating` Flag Safety

Array mutation methods use a `mutating` flag to distinguish between direct property sets (e.g., `arr[0] = 'x'`) and method calls (e.g., `arr.push('x'`). The flag is wrapped in `try/finally` to ensure it is always reset, preventing a stuck `true` state if the mutation throws:

```ts
if (Array.isArray(target) && ARRAY_MUTATION_METHODS.includes(prop as any)) {
  return (...args: any[]) => {
    mutating = true
    const oldLength = target.length
    try {
      const result = (target as any)[prop](...args)
      operator.onObjectPropertySet(key, target)
      if (target.length !== oldLength) {
        operator.emitter.emit(`${key}.length`, target.length, oldLength)
      }
      return result
    }
    finally {
      mutating = false
    }
  }
}
```

## Serializer

Pure function module with no external dependencies.

### Storage Format

```json
{
  "type": "Number",
  "value": "42",
  "options": { "expires": 1716566400000, "disposable": true }
}
```

For Object and Array types, the `value` field stores the nested object/array directly (not a double-encoded string), preserving backward compatibility with existing stored data:

```json
{
  "type": "Object",
  "value": { "a": 1, "b": "test" },
  "options": {}
}
```

```json
{
  "type": "Array",
  "value": [1, "two", null],
  "options": {}
}
```

This means the Object/Array serializer uses `identity` for both encode and decode — the `JSON.stringify` of the outer envelope handles serialization, and `JSON.parse` of the envelope handles deserialization.

### Supported Types

String, Number, BigInt, Boolean, Null, Undefined, Object, Array, Date, URL, RegExp, Function, Set, Map.

Each type has a registered `{ encode, decode }` pair in a serializer registry. The registry is a plain object (not a class), making it easy to extend if needed in the future.

### Separation from Proxy Creation

The serializer's `decode` function returns raw data only (`{ value, type, options }`). It does NOT create Proxy objects. This eliminates the circular dependency that existed in the old `transform.ts → object.ts → transform.ts` chain.

### API Signature Change

The `encode` and `decode` functions have simplified signatures compared to the old `transform.ts`:

```ts
// Old
encode({ data: value, options }): string
decode({ data: raw, storage, property }): StorageObject | string | null

// New
encode(data: any, options?: StorageOptions): string
decode(raw: string | null): DecodedItem | null | string
```

E2E test files that import `encode`/`decode` must be updated to use the new signatures. The imports should also be updated from `@/proxy/transform` to the new module paths.

## Entry Point Assembly

```ts
export interface ProxyStorageOptions {
  broadcast?: boolean
  channel?: string
}
```

- `broadcast`: controls whether broadcast is enabled (default: `true`, auto-disabled for `sessionStorage`)
- `channel`: storage identifier for broadcast message filtering. Auto-detected as `'localStorage'` for `localStorage`. Required for custom async storage backends (e.g., localForage) to enable cross-tab sync.

```ts
export function createProxyStorage(storage: SyncStorageLike, options?: ProxyStorageOptions): ProxyStorage
export function createProxyStorage(storage: AsyncStorageLike, options?: ProxyStorageOptions): AsyncProxyStorage
export function createProxyStorage(storage: StorageLike, options?: ProxyStorageOptions) {
  // 1. Validate storage interface
  validateStorage(storage)

  // 2. Detect sync/async mode
  const isAsync = detectAsync(storage)

  // 3. Determine broadcast configuration
  const broadcastEnabled = shouldEnableBroadcast(storage, options?.broadcast)
  const channelId = broadcastEnabled ? resolveChannelId(storage, options?.channel) : null

  // 4. Create components
  const scheduler = isAsync ? new AsyncScheduler() : new SyncScheduler()
  const strategy = isAsync ? new AsyncStrategy() : new SyncStrategy()
  const cache = new CacheStore()
  const emitter = new EventEmitter()
  const broadcast = new StorageBroadcast(channelId)

  // 5. Assemble Operator
  const operator = new StorageOperator(storage, scheduler, strategy, cache, emitter, broadcast)

  // 6. Create Proxy
  const proxy = new Proxy(storage, createProxyHandler(operator))

  // 7. Start broadcast listener
  broadcast.listen(msg => operator.handleBroadcast(msg))

  return proxy
}
```

### `validateStorage`

Synchronously validates that the storage object implements the required interface:

```ts
function validateStorage(storage: StorageLike): void {
  const required = ['getItem', 'setItem', 'removeItem', 'clear', 'key']
  for (const method of required) {
    if (!isFunction(storage[method])) {
      throw new Error(`Invalid storage: missing ${method} method`)
    }
  }
}
```

### `detectAsync`

Uses a probe key that is unlikely to conflict with user data:

```ts
function detectAsync(storage: StorageLike): boolean {
  const probe = storage.getItem('__stokado_probe__')
  return isPromise(probe)
}
```

### `shouldEnableBroadcast`

Determines whether broadcast should be enabled based on options and storage type:

- `sessionStorage` always disables broadcast (cross-tab sync is meaningless — each tab has its own sessionStorage)
- Otherwise, respects `options.broadcast` (default `true`)

```ts
function shouldEnableBroadcast(storage: StorageLike, broadcast?: boolean): boolean {
  if (typeof window !== 'undefined' && storage === window.sessionStorage)
    return false
  return broadcast ?? true
}
```

### `resolveChannelId`

Returns the channel identifier for the storage instance. Used for broadcast message filtering:

- If `options.channel` is provided, use it directly
- Auto-detect for `localStorage` as `'localStorage'`
- Returns `null` when no channel can be determined (broadcast still works but without filtering)

```ts
function resolveChannelId(storage: StorageLike, channel?: string): string | null {
  if (channel)
    return channel
  if (typeof window !== 'undefined') {
    if (storage === window.localStorage)
      return 'localStorage'
  }
  return null
}
```

When `resolveChannelId` returns `null`, `StorageBroadcast` receives `null` and messages are sent without a `channel` field. Received messages without a `channel` field are always processed (no filtering). This is acceptable for single-storage apps.

### TypeScript Overloads

```ts
export function createProxyStorage(storage: SyncStorageLike, options?: ProxyStorageOptions): ProxyStorage
export function createProxyStorage(storage: AsyncStorageLike, options?: ProxyStorageOptions): AsyncProxyStorage
```

- `ProxyStorage`: all methods return synchronous values
- `AsyncProxyStorage`: all methods return Promises (except `on`/`off`/`once` which are synchronous subscriptions)

### API Changes from Previous Version

The second parameter has changed from `name?: string` to `options?: ProxyStorageOptions`:

```ts
// Old API
createProxyStorage(localStorage, 'my-app')
createProxyStorage(localForage, 'my-db')

// New API
createProxyStorage(localStorage) // broadcast auto-enabled, channel auto-detected as 'localStorage'
createProxyStorage(localStorage, { broadcast: false }) // broadcast disabled
createProxyStorage(sessionStorage) // broadcast auto-disabled for sessionStorage
createProxyStorage(localForage, { channel: 'my-db' }) // broadcast enabled with channel identifier
```

For async storage backends (localForage, IndexedDB) that previously used the `name` parameter for cross-tab sync, the `channel` option now provides the storage identifier for broadcast message filtering. All instances share the same `BroadcastChannel('stokado::channel')`, and messages are filtered by the `channel` field.

## Utility Functions

### `formatTime`

Ensures the return type is always `number`:

```ts
export function formatTime(time: any): number {
  if (time instanceof Date)
    return time.getTime()
  if (typeof time === 'string')
    return +time.padEnd(13, '0')
  return +time
}
```

## Testing Strategy

### Existing E2E Tests (Updated)

All Playwright tests in `tests/` remain as the regression suite. The following changes are required:

1. **`encode`/`decode` signature update**: Change from `encode({ data, options })` to `encode(data, options?)` and from `decode({ data })` to `decode(raw)`.
2. **Import path update**: Change from `@/proxy/transform` to `@/serializer/encode` and `@/serializer/decode` (or re-export from `src/index.ts`).
3. **Return value assertions**: Property access assertions for missing/expired/disposed keys expect `undefined` (no change needed — ProxyHandler converts `null` to `undefined`).

### New Unit Tests (vitest)

Add unit tests covering:

| Module | Test Focus |
|--------|-----------|
| `AsyncScheduler` | Per-key serialization, cross-key parallelism, `flushAll`, error isolation, memory cleanup |
| `SyncScheduler` | Direct execution, no-op flush |
| `Serializer` | Round-trip encode/decode for all 14 types, edge cases (empty string, NaN, Infinity) |
| `CacheStore` | get/set/delete, object proxy caching, clear |
| `EventEmitter` | on/off/once, emit always fires (hasChanged is caller's responsibility), sub-key emission |
| `StorageOperator` | Integration with mocked strategy/scheduler; race condition scenarios from issue 3.3 |
| `ProxyHandler` | Method interception, property access delegation, null→undefined conversion |
| `createObjectProxy` | Nested mutation → re-serialization, array method interception (including `sort`/`reverse`), reference stability, `try/finally` safety |

### Race Condition Test (Critical)

Specifically test the scenario from requirement 3.3:

```ts
const storage = createProxyStorage(mockAsyncStorage)
await storage.setItem('key', 'value')
const removePromise = storage.removeItem('key')
const getPromise = storage.getItem('key')
await removePromise
const result = await getPromise
expect(result).toBeNull()
```

### Return Value Test

Verify the null/undefined convention:

```ts
// Property access returns undefined
expect(proxy.nonexistent).toBeUndefined()
expect(proxy.expiredKey).toBeUndefined()

// getItem returns null
expect(proxy.getItem('nonexistent')).toBeNull()
expect(proxy.getItem('expiredKey')).toBeNull()
```

## Code Smell Removal

As part of this refactor, the following issues are also addressed:

1. **Circular dependency** — eliminated by separating serializer from proxy creation
2. **Global `prevPromise` state** — replaced by instance-level Scheduler
3. **Debug `console.log` statements** — removed from `object.ts` and `broadcast.ts`
4. **`isStorage` async function misuse** — replaced with synchronous `validateStorage`
5. **Stream-of-consciousness comments in `setItem`** — replaced with clear, structured code that is self-documenting
6. **`registerObjectCreator` pattern** — eliminated; Operator directly creates object proxies
7. **`removeExpires` cache mutation bug** — fixed by using object spread instead of `delete` on cached options
8. **Dead `hasChanged` function in EventEmitter** — removed

## Known Limitations

- **`key()` and `length` consistency**: These operations bypass the Scheduler and read directly from the storage backend. In async mode, if `setItem`/`removeItem` operations are pending, `key()` and `length` may return stale values. This is acceptable because: (1) these methods are rarely used; (2) the previous version had the same limitation; (3) fixing this would require `flushAll()` before each call, adding unnecessary latency.

## Migration Notes

- **Breaking API change**: `createProxyStorage(storage, name?)` → `createProxyStorage(storage, options?)`. The `name` parameter is removed; broadcast is now controlled by `options.broadcast` (default `true`) with auto-detection for `localStorage`/`sessionStorage`. Use `options.channel` to specify a storage identifier for custom backends.
- **Behavior change**: `removeItem` no longer emits events for non-existent keys. Previously, events were emitted regardless (with `oldValue: undefined`). Now, events are only emitted when the key actually exists in storage.
- No changes to the serialized storage format (existing stored data remains compatible)
- Build output (ESM, CJS, IIFE, DTS) structure unchanged
- ⚠️ **BroadcastChannel message format is incompatible** with the previous version. The format changed from `{ key, newValue, oldValue, property }` to `{ type, key?, encoded?, channel? }`. Old and new versions running in the same browser will not cross-sync. Since BroadcastChannel messages are ephemeral (lost on page reload), this does not affect persistent data.
- ⚠️ **BroadcastChannel name changed** from `stokado:${name}` to the unified `stokado::channel`. Old and new versions will not see each other's broadcasts.
- `tsconfig.json` `include` paths must be updated from `["src/*.ts", "src/*/*.ts", "tests/*.ts"]` to `["src/**/*.ts", "tests/**/*.ts"]` to cover the new deeper directory structure
- `key()` and `length` do not go through the Scheduler — they may return stale values if async operations are pending. This is a known limitation consistent with the previous version's behavior.
