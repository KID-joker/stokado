# Stokado Architecture Refactor Design

## Overview

Refactor the internal architecture of Stokado while preserving the existing public API (`createProxyStorage(storage, name?)`) and all current functionality. The goal is to establish clear separation of concerns, eliminate global mutable state, resolve the async operation ordering problem, and improve testability.

## Design Decisions

| Concern | Decision |
|---------|----------|
| Async operation queue | Per-key independent queues; same-key operations execute strictly in call order |
| Cross-key operations | `clear()` waits for all active queues to drain before executing |
| Sync/Async architecture | Unified core with Strategy pattern (SyncStrategy / AsyncStrategy) |
| External API | Fully backward-compatible; no changes to `createProxyStorage` signature |
| Nested object proxy | Behavior unchanged; sub-property mutations re-serialize the entire parent object |
| Refactoring scope | Core architecture + code smell removal + unit test additions |
| Testing strategy | Keep existing Playwright E2E tests + add vitest unit tests |

## Module Structure

```
src/
├── index.ts                    # Entry point, exports createProxyStorage
├── types.ts                    # All type definitions
│
├── core/
│   ├── operator.ts             # StorageOperator — orchestrates high-level operations
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
│   └── decode.ts               # Decode (storage string → value)
│
├── cache/
│   └── store.ts                # CacheStore — instance-level cache management
│
├── events/
│   ├── emitter.ts              # Event subscription/emission (on/off/once/emit)
│   └── broadcast.ts            # Cross-tab BroadcastChannel sync
│
└── extends/
    ├── expires.ts              # setExpires/getExpires/removeExpires
    ├── disposable.ts           # setDisposable/checkDisposable
    └── options.ts              # getOptions
```

### Dependency Direction (Acyclic)

```
index → core/operator
core/operator → scheduler, strategy, serializer, cache, events, extends
core/proxy-handler → core/operator
core/proxy-object → core/operator
scheduler → (no external deps)
strategy → (no external deps)
serializer → (no external deps)
cache → (no external deps)
events → (no external deps)
```

Key change: The circular dependency between `transform.ts` and `object.ts` is eliminated. The serializer performs pure data transformation only; Proxy creation is handled by the Operator in `getItem`.

## Scheduler

### Interface

```ts
interface Scheduler {
  /**
   * Schedule an operation onto the queue for the given key.
   * - Sync: executes operation() directly and returns the result
   * - Async: appends operation to the key's queue, returns Promise
   */
  enqueue<T>(key: string, operation: () => T | Promise<T>): T | Promise<T>

  /**
   * Wait for all queued operations on a given key to complete.
   * - Sync: no-op
   * - Async: returns Promise that resolves when the key's queue is drained
   */
  flush(key: string): void | Promise<void>

  /**
   * Wait for all keys' queues to complete (used by clear() and other cross-key ops).
   * - Sync: no-op
   * - Async: waits for all active queues to drain
   */
  flushAll(): void | Promise<void>
}
```

### SyncScheduler

Direct execution with zero overhead:

```ts
class SyncScheduler implements Scheduler {
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
  private queues = new Map<string, Promise<any>>()

  enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(key) ?? Promise.resolve()
    const next = prev.then(() => operation()).then(
      (result) => {
        if (this.queues.get(key) === next) this.queues.delete(key)
        return result
      },
      (error) => {
        if (this.queues.get(key) === next) this.queues.delete(key)
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
  getItem(storage: StorageLike, key: string): string | null | Promise<string | null>
  setItem(storage: StorageLike, key: string, value: string): void | Promise<void>
  removeItem(storage: StorageLike, key: string): void | Promise<void>
  clear(storage: StorageLike): void | Promise<void>
  length(storage: StorageLike): number | Promise<number>
  key(storage: StorageLike, index: number): string | null | Promise<string | null>
}
```

### SyncStrategy

Directly calls the underlying storage methods and returns synchronous values.

### AsyncStrategy

Wraps each call with `await` and returns Promises.

### Auto-detection

```ts
function detectAsync(storage: StorageLike): boolean {
  // Probe with empty string key. For localStorage this returns null synchronously.
  // For localForage this returns a Promise (even if the key doesn't exist).
  // This is safe because getItem('') is a read-only operation with no side effects.
  const probe = storage.getItem('')
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
      emitter.emit('test', 'hello', oldValue)  // fire events
    })
  → Sync: lambda executes immediately, returns synchronously
  → Async: appended to key='test' queue, returns Promise
```

All steps within `enqueue`'s operation (serialization, I/O, cache update, event emission) form an atomic unit — no other operation on the same key can interleave.

## StorageOperator

The central orchestrator that composes Scheduler, Strategy, Serializer, Cache, and Emitter.

```ts
class StorageOperator {
  constructor(
    private storage: StorageLike,
    private scheduler: Scheduler,
    private strategy: StorageStrategy,
    private cache: CacheStore,
    private emitter: EventEmitter,
    private broadcast: StorageBroadcast,
  ) {}

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
  getExpires(key: string): Date | null | Promise<Date | null>
  removeExpires(key: string): void | Promise<void>
  setDisposable(key: string, value: any): void | Promise<void>
  getOptions(key: string): StorageOptions | null | Promise<StorageOptions | null>

  // --- Nested object support ---
  createObjectProxy(key: string, rawValue: object): object
  onObjectPropertySet(key: string, fullValue: object): void | Promise<void>

  // --- Broadcast handling ---
  handleBroadcast(msg: BroadcastMessage): void
}
```

### Internal Flow: getItem

```ts
getItem(key: string) {
  return this.scheduler.enqueue(key, () => {
    // 1. Check cache
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      if (isExpired(cached)) {
        this.strategy.removeItem(this.storage, key)
        this.cache.delete(key)
        return null
      }
      if (cached.options?.disposable) {
        this.strategy.removeItem(this.storage, key)
        this.cache.delete(key)
      }
      return cached.value  // or cached objectProxy for Object/Array
    }

    // 2. Cache miss — read from storage
    const raw = this.strategy.getItem(this.storage, key)
    //   sync: returns string|null
    //   async: returns Promise<string|null>
    return resolve(raw, (rawValue) => {
      if (rawValue === null) return null
      const decoded = decode(rawValue)
      this.cache.set(key, decoded)

      // 3. Check expiration (same logic as cache-hit path)
      if (isExpired(decoded)) {
        this.strategy.removeItem(this.storage, key)
        this.cache.delete(key)
        return null
      }

      // 4. Check disposable — return value once, then delete from storage
      if (decoded.options?.disposable) {
        this.strategy.removeItem(this.storage, key)
        this.cache.delete(key)
        // Fall through to return decoded.value below
      }

      // 5. Object/Array → wrap in proxy for deep reactivity
      if (decoded.type === 'Object' || decoded.type === 'Array') {
        return this.getOrCreateObjectProxy(key, decoded.value)
      }
      return decoded.value
    })
  })
}
```

### Internal Flow: setItem

```ts
setItem(key: string, value: any, options?: StorageOptions) {
  return this.scheduler.enqueue(key, () => {
    const oldValue = this.cache.get(key)?.value
    const encoded = encode(value, options)
    return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
      this.cache.set(key, { value, type: getType(value), options })
      this.emitter.emit(key, value, oldValue)
      this.broadcast.post({ type: 'set', key, encoded })
    })
  })
}
```

### Internal Flow: clear

```ts
clear() {
  const doFlush = this.scheduler.flushAll()
  const doClear = () => {
    return resolve(this.strategy.clear(this.storage), () => {
      this.cache.clear()
      this.broadcast.post({ type: 'clear' })
    })
  }
  return resolve(doFlush, doClear)
}
```

### The `resolve` Helper

A lightweight utility that avoids dual code paths:

```ts
function resolve<T, R>(val: T | Promise<T>, fn: (v: T) => R | Promise<R>): R | Promise<R> {
  if (isPromise(val)) return val.then(fn)
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

class EventEmitter {
  private listeners = new Map<string, Set<Listener>>()

  on(key: string, fn: Listener): void
  once(key: string, fn: Listener): void
  off(key: string, fn?: Listener): void
  offAll(): void
  emit(key: string, newValue: any, oldValue: any): void
  hasChanged(newValue: any, oldValue: any): boolean
}
```

### Event Emission Rules

| Trigger | Events Emitted |
|---------|---------------|
| `storage.name = 'x'` | `emit('name', 'x', oldValue)` |
| `storage.user.age = 18` | `emit('user', user, user)` + `emit('user.age', 18, oldAge)` |
| `storage.list.push(item)` | `emit('list', list, list)` + `emit('list.length', newLen, oldLen)` |

## StorageBroadcast

Cross-tab synchronization via BroadcastChannel. Only active when a `name` is provided.

```ts
type BroadcastMessage =
  | { type: 'set'; key: string; encoded: string }
  | { type: 'remove'; key: string }
  | { type: 'clear' }

class StorageBroadcast {
  private channel: BroadcastChannel | null

  constructor(name: string | null)
  post(message: BroadcastMessage): void
  listen(onMessage: (msg: BroadcastMessage) => void): void
  destroy(): void
}
```

Incoming broadcast messages bypass the Scheduler (the actual storage I/O was already performed by the sender). They directly update the cache and trigger emitter events.

## ProxyHandler

Translates property access into Operator calls.

```ts
function createProxyHandler(operator: StorageOperator): ProxyHandler<StorageLike> {
  return {
    get(target, prop: string) {
      // 1. Built-in instrumentation methods (on/off/once/setExpires/...)
      // 2. Standard Storage interface (getItem/setItem/removeItem/clear/key/length)
      // 3. Direct property access → operator.getItem(prop)
    },
    set(target, prop: string, value) {
      operator.setItem(prop, value)
      return true
    },
    deleteProperty(target, prop: string) {
      operator.removeItem(prop)
      return true
    }
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
- **Property set** (`obj.prop = val`): mutates the raw object, then calls `operator.onObjectPropertySet(key, obj)` to re-serialize and write back
- **Array mutations** (`push/pop/shift/unshift/splice/sort/reverse`): mutates the array, then triggers re-serialization + length change events
- **Property delete**: removes from raw object, triggers re-serialization

Reference stability is guaranteed: `storage.obj === storage.obj` returns `true` because `CacheStore` caches the proxy instance.

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

### Supported Types

String, Number, BigInt, Boolean, Null, Undefined, Object, Array, Date, URL, RegExp, Function, Set, Map.

Each type has a registered `{ encode, decode }` pair in a serializer registry. The registry is a plain object (not a class), making it easy to extend if needed in the future.

### Separation from Proxy Creation

The serializer's `decode` function returns raw data only (`{ value, type, options }`). It does NOT create Proxy objects. This eliminates the circular dependency that existed in the old `transform.ts → object.ts → transform.ts` chain.

## Entry Point Assembly

```ts
export function createProxyStorage(storage: StorageLike, name?: string) {
  // 1. Validate storage interface
  validateStorage(storage)

  // 2. Detect sync/async mode
  const isAsync = detectAsync(storage)

  // 3. Create components
  const scheduler = isAsync ? new AsyncScheduler() : new SyncScheduler()
  const strategy = isAsync ? new AsyncStrategy() : new SyncStrategy()
  const cache = new CacheStore()
  const emitter = new EventEmitter()
  const broadcast = new StorageBroadcast(name ?? detectName(storage))

  // 4. Assemble Operator
  const operator = new StorageOperator(storage, scheduler, strategy, cache, emitter, broadcast)

  // 5. Create Proxy
  const proxy = new Proxy(storage, createProxyHandler(operator))

  // 6. Start broadcast listener
  broadcast.listen((msg) => operator.handleBroadcast(msg))

  return proxy
}
```

### TypeScript Overloads

```ts
export function createProxyStorage(storage: SyncStorageLike, name?: string): ProxyStorage
export function createProxyStorage(storage: AsyncStorageLike, name?: string): AsyncProxyStorage
```

- `ProxyStorage`: all methods return synchronous values
- `AsyncProxyStorage`: all methods return Promises (except `on`/`off`/`once` which are synchronous subscriptions)

## Testing Strategy

### Existing E2E Tests (Unchanged)

All Playwright tests in `tests/` remain as the regression suite. They validate end-to-end behavior in a real browser environment.

### New Unit Tests (vitest)

Add unit tests covering:

| Module | Test Focus |
|--------|-----------|
| `AsyncScheduler` | Per-key serialization, cross-key parallelism, `flushAll`, error isolation, memory cleanup |
| `SyncScheduler` | Direct execution, no-op flush |
| `Serializer` | Round-trip encode/decode for all 14 types, edge cases (empty string, NaN, Infinity) |
| `CacheStore` | get/set/delete, object proxy caching, clear |
| `EventEmitter` | on/off/once, hasChanged logic, sub-key emission |
| `StorageOperator` | Integration with mocked strategy/scheduler; race condition scenarios from issue 3.3 |
| `ProxyHandler` | Method interception, property access delegation |
| `createObjectProxy` | Nested mutation → re-serialization, array method interception, reference stability |

### Race Condition Test (Critical)

Specifically test the scenario from requirement 3.3:

```ts
// With async storage, consecutive calls must serialize correctly
const storage = createProxyStorage(mockAsyncStorage)
await storage.setItem('key', 'value')
const removePromise = storage.removeItem('key')  // internally: getItem → removeItem
const getPromise = storage.getItem('key')        // must wait for removeItem to finish
const result = await getPromise
expect(result).toBe(null)  // NOT the old value
```

## Code Smell Removal

As part of this refactor, the following issues are also addressed:

1. **Circular dependency** — eliminated by separating serializer from proxy creation
2. **Global `prevPromise` state** — replaced by instance-level Scheduler
3. **Debug `console.log` statements** — removed from source (no longer relying on build-time stripping)
4. **`isStorage` async function misuse** — replaced with synchronous `validateStorage`
5. **Stream-of-consciousness comments in `setItem`** — replaced with clear, structured code that is self-documenting
6. **`registerObjectCreator` pattern** — eliminated; Operator directly creates object proxies

## Migration Notes

- No changes to the public API surface
- No changes to the serialized storage format (existing stored data remains compatible)
- Build output (ESM, CJS, IIFE, DTS) structure unchanged
- BroadcastChannel message format may change (this is internal and cross-tab state is ephemeral)
