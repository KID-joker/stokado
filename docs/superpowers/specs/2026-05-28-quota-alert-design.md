# Quota Alert Design

## Overview

Add memory quota alert functionality to `createProxyStorage`. Users can set a storage size limit and receive a callback when the limit is exceeded, with the option to block the write.

## Decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Which layer to track | Persistent storage size (not CacheStore JS memory) |
| Q2 | Unit | Bytes, with `KB` / `MB` constants exported |
| Q3 | Check timing | On every `setItem` |
| Q4 | Callback behavior | Notify + return `false` to block write |
| Q5 | Size calculation | Internal size counter (incremental tracking) |
| Q6 | Scope | Track stokado-managed keys + pre-existing keys at init |
| Q7 | Init scan performance | Default: scan all keys at init. Document that this is expected |
| Q8 | Non-stokado writes | Best-effort: listen to `storage` events for cross-tab writes. Same-tab direct writes not trackable (documented limitation) |
| Q9 | Callback timing | Before write (so `return false` can block) |
| Q10 | Query API | Expose `getUsage()` returning `{ current, limit }` |
| Q11 | Naming | `quota` + `onQuotaExceeded` |
| Q12 | Async init timing | Background init + expose `ready: Promise<void>` |

## What is counted

The **encoded size actually stored** in the underlying storage, including:
- The key name (UTF-8 bytes)
- The encoded value string (UTF-8 bytes), i.e. the full `StorageEnvelope` JSON produced by `encode()`

This matches what the browser counts against storage quotas.

Calculation: `new Blob([key]).size + new Blob([encoded]).size`

## New Types

```ts
export interface QuotaInfo {
  current: number
  limit: number
  key: string
  value: any
}

export interface ProxyStorageOptions {
  broadcast?: boolean
  channel?: string
  quota?: number
  onQuotaExceeded?: (info: QuotaInfo) => boolean | void | Promise<boolean | void>
}
```

`ProxyStorage` / `AsyncProxyStorage` additions:

```ts
getUsage(): { current: number; limit: number }
ready: Promise<void>
```

Exported constants:

```ts
export const KB = 1024
export const MB = 1024 * KB
```

## Architecture

### Approach: SizeTracker integrated into StorageOperator

```
createProxyStorage(storage, { quota, onQuotaExceeded })
  → StorageOperator
      → sizeTracker: SizeTracker | null   (null when quota not set)
      → cache, emitter, scheduler, strategy, broadcast
```

SizeTracker is a standalone class that encapsulates all size-tracking logic. StorageOperator calls into it at the right points in its existing setItem/removeItem/clear flow.

### SizeTracker class

```ts
class SizeTracker {
  private sizeMap = new Map<string, number>()  // key → encoded byte size (key + value)
  private _current = 0
  private _limit: number
  private _onQuotaExceeded?: (info: QuotaInfo) => boolean | void | Promise<boolean | void>

  get current(): number
  get limit(): number

  init(storage, strategy): Promise<void> | void
  add(key: string, encoded: string): void
  remove(key: string): void
  clear(): void
  check(key: string, encoded: string, value: any): boolean | Promise<boolean>
  getUsage(): { current: number; limit: number }
}
```

**init(storage, strategy)**:
- Sync storage: iterate `storage.length` + `storage.key(i)` + `storage.getItem(key)`, compute `byteSize(key) + byteSize(raw)` for each key
- Async storage: same logic using `strategy.length()` + `strategy.key(i)` + `strategy.getItem(key)`
- Store each key's size in `sizeMap`, sum to `_current`

**add(key, encoded)**:
- Compute `newSize = byteSize(key) + byteSize(encoded)`
- If key already in sizeMap, `delta = newSize - sizeMap.get(key)`, else `delta = newSize`
- Update `sizeMap.set(key, newSize)` and `_current += delta`

**remove(key)**:
- If key in sizeMap, `_current -= sizeMap.get(key)`, then `sizeMap.delete(key)`

**clear()**:
- `sizeMap.clear()`, `_current = 0`

**check(key, encoded, value)**:
- Compute `newSize = byteSize(key) + byteSize(encoded)`
- `delta = key exists in sizeMap ? newSize - sizeMap.get(key) : newSize`
- If `_current + delta > _limit`:
  - Call `onQuotaExceeded({ current: _current + delta, limit: _limit, key, value })`
  - If callback returns `false` (or `Promise<false>`), return `false` (block write)
- Return `true` (allow write)

Helper:

```ts
function byteSize(str: string): number {
  return new Blob([str]).size
}
```

### StorageOperator changes

Constructor receives optional `SizeTracker`:

```ts
constructor(
  public readonly storage: any,
  private scheduler: Scheduler,
  private strategy: StorageStrategy,
  public readonly cache: CacheStore,
  public readonly emitter: EventEmitter,
  private broadcast: StorageBroadcast,
  private sizeTracker: SizeTracker | null,  // new
)
```

**setItem** changes:
1. Before writing: if `sizeTracker`, call `sizeTracker.check(key, encoded, normalizedValue)`. If returns `false`, skip the write and return early.
2. After successful write: if `sizeTracker`, call `sizeTracker.add(key, encoded)`.

**removeItem** changes:
1. After successful remove: if `sizeTracker`, call `sizeTracker.remove(key)`.

**clear** changes:
1. After successful clear: if `sizeTracker`, call `sizeTracker.clear()`.

**handleBroadcast** changes:
- `set` message: call `sizeTracker?.add(msg.key, msg.encoded)`
- `remove` message: call `sizeTracker?.remove(msg.key)`
- `clear` message: call `sizeTracker?.clear()`

### createProxyStorage changes

```ts
export function createProxyStorage(storage: StorageLike, options?: ProxyStorageOptions) {
  validateStorage(storage)
  const isAsync = detectAsync(storage)
  // ... existing setup

  const sizeTracker = options?.quota
    ? new SizeTracker(options.quota, options.onQuotaExceeded)
    : null

  const operator = new StorageOperator(storage, scheduler, strategy, cache, emitter, broadcast, sizeTracker)

  // Init: scan existing keys
  const initResult = sizeTracker?.init(storage, strategy)
  const ready = initResult instanceof Promise ? initResult : Promise.resolve()

  const proxy = new Proxy(storage, createProxyHandler(operator, sizeTracker, ready))

  broadcast.listen(msg => operator.handleBroadcast(msg))

  return proxy
}
```

The proxy handler needs to expose `getUsage` and `ready` on the proxy object. This is done by adding traps in `createProxyHandler` for these specific property accesses.

### Proxy handler changes

In `createProxyHandler`, add `get` trap cases:

```ts
get(target, prop, receiver) {
  if (prop === 'getUsage') {
    return () => sizeTracker?.getUsage() ?? { current: 0, limit: 0 }
  }
  if (prop === 'ready') {
    return ready
  }
  // ... existing logic
}
```

## Usage Examples

```ts
import { createProxyStorage, MB } from 'stokado'

const storage = createProxyStorage(localStorage, {
  quota: 5 * MB,
  onQuotaExceeded({ current, limit, key, value }) {
    console.warn(`Storage quota exceeded: ${current}/${limit} bytes, key: "${key}"`)
    return false  // block the write
  }
})

// Check current usage
const { current, limit } = storage.getUsage()

// Wait for init to complete (relevant for async storages)
await storage.ready
```

## Known Limitations (to document in README)

1. Quota tracking only covers data written through the stokado proxy + pre-existing keys scanned at initialization.
2. Direct writes to the underlying storage from the same tab (bypassing stokado) are not tracked and may cause actual usage to exceed the quota without triggering an alert.
3. Cross-tab writes via the underlying storage are tracked through the `storage` event when broadcast is enabled, but there may be a brief delay.
4. The size calculation is based on the UTF-8 byte size of the encoded envelope, which closely approximates but may not exactly match the browser's internal storage accounting.
