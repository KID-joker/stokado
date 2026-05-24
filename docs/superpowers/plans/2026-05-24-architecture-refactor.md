# Stokado Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Stokado's internal architecture to use Strategy + per-key Scheduler pattern while keeping the public API and all existing tests passing.

**Architecture:** Unified core with Strategy pattern (SyncStrategy/AsyncStrategy) for I/O, per-key Scheduler for operation ordering, instance-level CacheStore/EventEmitter/Broadcast — all orchestrated by a central StorageOperator. The serializer is decoupled from proxy creation to eliminate circular dependencies.

**Tech Stack:** TypeScript, Rollup (build), Playwright (E2E tests), Vitest (new unit tests)

---

## File Structure

### Files to Create

| Path | Responsibility |
|------|---------------|
| `src/core/operator.ts` | StorageOperator class — orchestrates all high-level operations |
| `src/core/proxy-handler.ts` | Proxy get/set/deleteProperty handler for createProxyStorage |
| `src/core/proxy-object.ts` | Nested object/array Proxy handler |
| `src/scheduler/types.ts` | Scheduler interface definition |
| `src/scheduler/sync-scheduler.ts` | SyncScheduler — direct execution |
| `src/scheduler/async-scheduler.ts` | AsyncScheduler — per-key queue |
| `src/strategy/types.ts` | StorageStrategy interface definition |
| `src/strategy/sync-strategy.ts` | SyncStrategy — synchronous I/O |
| `src/strategy/async-strategy.ts` | AsyncStrategy — Promise-based I/O |
| `src/serializer/encode.ts` | encode function |
| `src/serializer/decode.ts` | decode function |
| `src/serializer/registry.ts` | Type serializer registry |
| `src/cache/store.ts` | CacheStore class |
| `src/events/emitter.ts` | EventEmitter class |
| `src/events/broadcast.ts` | StorageBroadcast class |

| `src/utils.ts` | Utility functions (trimmed, no pThen) |
| `src/types.ts` | All type definitions (updated) |
| `src/index.ts` | Entry point (updated) |
| `vitest.config.ts` | Vitest configuration |
| `tests/unit/scheduler.test.ts` | Unit tests for Scheduler |
| `tests/unit/serializer.test.ts` | Unit tests for Serializer |
| `tests/unit/cache-store.test.ts` | Unit tests for CacheStore |
| `tests/unit/emitter.test.ts` | Unit tests for EventEmitter |
| `tests/unit/operator.test.ts` | Integration tests for StorageOperator |
| `tests/unit/proxy-object.test.ts` | Unit tests for nested object proxy |

### Files to Delete (after refactor complete)

| Path | Reason |
|------|--------|
| `src/cache.ts` | Replaced by `src/cache/store.ts` |
| `src/shared.ts` | Logic moved into `StorageOperator` |
| `src/check_expired.ts` | Logic moved into `StorageOperator.getItem` |
| `src/effect.ts` | Replaced by `src/events/emitter.ts` |
| `src/proxy/storage.ts` | Replaced by `src/core/proxy-handler.ts` + `src/index.ts` |
| `src/proxy/object.ts` | Replaced by `src/core/proxy-object.ts` |
| `src/proxy/transform.ts` | Replaced by `src/serializer/` |
| `src/proxy/broadcast.ts` | Replaced by `src/events/broadcast.ts` |
| `src/extends/watch.ts` | Logic absorbed into `EventEmitter` + `StorageOperator` |
| `src/extends/disposable.ts` | Logic moved into `StorageOperator` |
| `src/extends/expires.ts` | Logic moved into `StorageOperator` |
| `src/extends/options.ts` | Logic moved into `StorageOperator` |

### Files to Modify

| Path | Change |
|------|--------|
| `package.json` | Add vitest dependency, add `test:unit` script |
| `tsconfig.json` | Update include paths for new directory structure |
| `rollup.config.js` | No change needed (entry point `src/index.ts` stays same) |

---

## Task 1: Project Setup — Add Vitest and Create Directory Structure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/core/` (directory)
- Create: `src/scheduler/` (directory)
- Create: `src/strategy/` (directory)
- Create: `src/serializer/` (directory)
- Create: `src/cache/` (directory)
- Create: `src/events/` (directory)
- Create: `tests/unit/` (directory)

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

- [ ] **Step 3: Add test:unit script to package.json**

Add to the `"scripts"` section:

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

- [ ] **Step 4: Create directory structure**

```bash
mkdir -p src/core src/scheduler src/strategy src/serializer src/cache src/events tests/unit
```

- [ ] **Step 5: Run vitest to verify setup**

```bash
npm run test:unit
```

Expected: No tests found (0 passed), exits cleanly.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: add vitest and create new module directory structure"
```

---

## Task 2: Scheduler — Interface and Implementations

**Files:**
- Create: `src/scheduler/types.ts`
- Create: `src/scheduler/sync-scheduler.ts`
- Create: `src/scheduler/async-scheduler.ts`
- Create: `tests/unit/scheduler.test.ts`

- [ ] **Step 1: Write the scheduler interface**

Create `src/scheduler/types.ts`:

```ts
export interface Scheduler {
  /**
   * Schedule an operation onto the queue for the given key.
   * Sync: executes directly and returns the result.
   * Async: appends to the key's queue, returns Promise.
   */
  enqueue<T>(key: string, operation: () => T | Promise<T>): T | Promise<T>

  /**
   * Wait for all queued operations on a given key to complete.
   * Sync: no-op. Async: returns Promise.
   */
  flush(key: string): void | Promise<void>

  /**
   * Wait for all keys' queues to complete.
   * Used by clear() and other cross-key operations.
   */
  flushAll(): void | Promise<void>
}
```

- [ ] **Step 2: Write failing tests for SyncScheduler**

Create `tests/unit/scheduler.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SyncScheduler } from '@/scheduler/sync-scheduler'

describe('SyncScheduler', () => {
  it('executes operation directly and returns result', () => {
    const scheduler = new SyncScheduler()
    const result = scheduler.enqueue('key', () => 42)
    expect(result).toBe(42)
  })

  it('flush is a no-op', () => {
    const scheduler = new SyncScheduler()
    expect(scheduler.flush('key')).toBeUndefined()
  })

  it('flushAll is a no-op', () => {
    const scheduler = new SyncScheduler()
    expect(scheduler.flushAll()).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm run test:unit
```

Expected: FAIL — cannot find module `@/scheduler/sync-scheduler`

- [ ] **Step 4: Implement SyncScheduler**

Create `src/scheduler/sync-scheduler.ts`:

```ts
import type { Scheduler } from './types'

export class SyncScheduler implements Scheduler {
  enqueue<T>(_key: string, operation: () => T): T {
    return operation()
  }

  flush(_key: string): void {}

  flushAll(): void {}
}
```

- [ ] **Step 5: Run tests to verify SyncScheduler passes**

```bash
npm run test:unit
```

Expected: All SyncScheduler tests PASS.

- [ ] **Step 6: Write failing tests for AsyncScheduler**

Append to `tests/unit/scheduler.test.ts`:

```ts
import { AsyncScheduler } from '@/scheduler/async-scheduler'

describe('AsyncScheduler', () => {
  it('enqueue returns a Promise', async () => {
    const scheduler = new AsyncScheduler()
    const result = scheduler.enqueue('key', async () => 42)
    expect(result).toBeInstanceOf(Promise)
    expect(await result).toBe(42)
  })

  it('serializes operations on the same key', async () => {
    const scheduler = new AsyncScheduler()
    const order: number[] = []

    const p1 = scheduler.enqueue('a', async () => {
      await delay(50)
      order.push(1)
    })

    const p2 = scheduler.enqueue('a', async () => {
      order.push(2)
    })

    await Promise.all([p1, p2])
    expect(order).toEqual([1, 2])
  })

  it('allows parallel execution on different keys', async () => {
    const scheduler = new AsyncScheduler()
    const order: string[] = []

    const p1 = scheduler.enqueue('a', async () => {
      await delay(50)
      order.push('a')
    })

    const p2 = scheduler.enqueue('b', async () => {
      order.push('b')
    })

    await Promise.all([p1, p2])
    // 'b' should finish before 'a' because they are parallel
    expect(order).toEqual(['b', 'a'])
  })

  it('flush waits for key queue to drain', async () => {
    const scheduler = new AsyncScheduler()
    let done = false

    scheduler.enqueue('a', async () => {
      await delay(50)
      done = true
    })

    await scheduler.flush('a')
    expect(done).toBe(true)
  })

  it('flushAll waits for all queues', async () => {
    const scheduler = new AsyncScheduler()
    const results: string[] = []

    scheduler.enqueue('a', async () => {
      await delay(30)
      results.push('a')
    })

    scheduler.enqueue('b', async () => {
      await delay(20)
      results.push('b')
    })

    await scheduler.flushAll()
    expect(results).toContain('a')
    expect(results).toContain('b')
  })

  it('error in one operation does not block subsequent operations', async () => {
    const scheduler = new AsyncScheduler()

    const p1 = scheduler.enqueue('a', async () => {
      throw new Error('fail')
    })

    const p2 = scheduler.enqueue('a', async () => 'recovered')

    await expect(p1).rejects.toThrow('fail')
    expect(await p2).toBe('recovered')
  })

  it('cleans up idle queues from memory', async () => {
    const scheduler = new AsyncScheduler()

    await scheduler.enqueue('a', async () => 'done')

    // Access internal state to verify cleanup
    expect((scheduler as any).queues.size).toBe(0)
  })
})

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

- [ ] **Step 7: Run tests to verify AsyncScheduler tests fail**

```bash
npm run test:unit
```

Expected: FAIL — cannot find module `@/scheduler/async-scheduler`

- [ ] **Step 8: Implement AsyncScheduler**

Create `src/scheduler/async-scheduler.ts`:

```ts
import type { Scheduler } from './types'

export class AsyncScheduler implements Scheduler {
  private queues = new Map<string, Promise<any>>()

  enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(key) ?? Promise.resolve()
    const next = prev.then(() => operation()).then(
      (result) => {
        if (this.queues.get(key) === next) {
          this.queues.delete(key)
        }
        return result
      },
      (error) => {
        if (this.queues.get(key) === next) {
          this.queues.delete(key)
        }
        throw error
      },
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

- [ ] **Step 9: Run tests to verify all pass**

```bash
npm run test:unit
```

Expected: All scheduler tests PASS.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: implement Scheduler interface with Sync and Async variants"
```

---

## Task 3: Serializer — Encode, Decode, and Registry

**Files:**
- Create: `src/serializer/registry.ts`
- Create: `src/serializer/encode.ts`
- Create: `src/serializer/decode.ts`
- Create: `tests/unit/serializer.test.ts`

- [ ] **Step 1: Write failing tests for serializer**

Create `tests/unit/serializer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { encode } from '@/serializer/encode'
import { decode } from '@/serializer/decode'

describe('Serializer', () => {
  describe('round-trip encode/decode', () => {
    // Helper to extract DecodedItem from decode result
    function decodeValue(data: any): any {
      const result = decode(encode(data))
      return (result as any).value
    }

    it('String', () => {
      const encoded = encode('hello', {})
      const decoded = decode(encoded) as any
      expect(decoded.value).toBe('hello')
      expect(decoded.type).toBe('String')
    })

    it('Number', () => {
      expect(decodeValue(42)).toBe(42)
      expect(decodeValue(0)).toBe(0)
      expect(decodeValue(-1)).toBe(-1)
      expect(decodeValue(3.14)).toBe(3.14)
      expect(decodeValue(NaN)).toBeNaN()
      expect(decodeValue(Infinity)).toBe(Infinity)
      expect(decodeValue(-Infinity)).toBe(-Infinity)
    })

    it('BigInt', () => {
      expect(decodeValue(1n)).toBe(1n)
      expect(decodeValue(9007199254740993n)).toBe(9007199254740993n)
    })

    it('Boolean', () => {
      expect(decodeValue(true)).toBe(true)
      expect(decodeValue(false)).toBe(false)
    })

    it('Null', () => {
      expect(decodeValue(null)).toBeNull()
    })

    it('Undefined', () => {
      expect(decodeValue(undefined)).toBeUndefined()
    })

    it('Object', () => {
      const obj = { a: 1, b: 'test', c: null }
      expect(decodeValue(obj)).toEqual(obj)
    })

    it('Array', () => {
      const arr = [1, 'two', null, { nested: true }]
      expect(decodeValue(arr)).toEqual(arr)
    })

    it('Date', () => {
      const d = new Date('2024-01-01T00:00:00.000Z')
      expect(decodeValue(d)).toEqual(d)
    })

    it('URL', () => {
      const url = new URL('https://example.com/path?q=1')
      expect(decodeValue(url)).toEqual(url)
    })

    it('RegExp', () => {
      const regex = /ab+c/gi
      const result = decodeValue(regex)
      expect(result.source).toBe(regex.source)
      expect(result.flags).toBe(regex.flags)
    })

    it('Function', () => {
      const fn = () => 'hello'
      const result = decodeValue(fn)
      expect(result()).toBe('hello')
    })

    it('Set', () => {
      const s = new Set([1, 2, 3])
      expect(decodeValue(s)).toEqual(s)
    })

    it('Map', () => {
      const m = new Map([['a', 1], ['b', 2]])
      expect(decodeValue(m)).toEqual(m)
    })
  })

  describe('options preservation', () => {
    it('preserves expires option', () => {
      const options = { expires: Date.now() + 1000 }
      const decoded = decode(encode('test', options)) as any
      expect(decoded.options).toEqual(options)
    })

    it('preserves disposable option', () => {
      const options = { disposable: true }
      const decoded = decode(encode('test', options)) as any
      expect(decoded.options).toEqual(options)
    })

    it('handles no options', () => {
      const decoded = decode(encode('test')) as any
      expect(decoded.options).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('decode returns null for null input', () => {
      expect(decode(null)).toBeNull()
    })

    it('decode returns the string for non-JSON input', () => {
      expect(decode('plain string')).toBe('plain string')
    })

    it('decode returns parsed object for unrecognized type', () => {
      const raw = JSON.stringify({ type: 'Unknown', value: 'test' })
      expect(decode(raw)).toEqual({ type: 'Unknown', value: 'test' })
    })

    it('encode throws for unsupported types', () => {
      expect(() => encode(Symbol('test') as any)).toThrow()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit
```

Expected: FAIL — cannot find modules.

- [ ] **Step 3: Implement serializer registry**

Create `src/serializer/registry.ts`:

```ts
interface Serializer<T = any> {
  encode: (value: T) => string
  decode: (raw: string) => T
}

const identity = (v: string): string => v
const toString = (v: any): string => String(v)

export const serializers: Record<string, Serializer> = {
  String: {
    encode: identity,
    decode: identity,
  },
  Number: {
    encode: toString,
    decode: (s) => Number.parseFloat(s),
  },
  BigInt: {
    encode: toString,
    decode: (s) => BigInt(s),
  },
  Boolean: {
    encode: toString,
    decode: (s) => s === 'true',
  },
  Null: {
    encode: () => 'null',
    decode: () => null,
  },
  Undefined: {
    encode: () => 'undefined',
    decode: () => undefined,
  },
  Object: {
    encode: (v) => JSON.stringify(v),
    decode: (s) => JSON.parse(s),
  },
  Array: {
    encode: (v) => JSON.stringify(v),
    decode: (s) => JSON.parse(s),
  },
  Set: {
    encode: (v) => JSON.stringify([...v]),
    decode: (s) => new Set(JSON.parse(s)),
  },
  Map: {
    encode: (v) => JSON.stringify([...v]),
    decode: (s) => new Map(JSON.parse(s)),
  },
  Date: {
    encode: (v) => v.toISOString(),
    decode: (s) => new Date(s),
  },
  URL: {
    encode: (v) => v.href,
    decode: (s) => new URL(s),
  },
  RegExp: {
    encode: toString, // produces /source/flags format — same as legacy
    decode: (s) => {
      // eslint-disable-next-line no-eval
      const eval2 = eval
      return eval2(s)
    },
  },
  Function: {
    encode: toString,
    decode: (s) => {
      // eslint-disable-next-line no-eval
      const eval2 = eval
      return eval2(`(function() { return ${s} })()`)
    },
  },
}
```

- [ ] **Step 4: Implement encode**

Create `src/serializer/encode.ts`:

```ts
import type { StorageOptions } from '@/types'
import { serializers } from './registry'
import { getRawType } from '@/utils'

export interface StorageEnvelope {
  type: string
  value: string
  options?: StorageOptions
}

export function encode(data: any, options?: StorageOptions): string {
  const type = getRawType(data)
  const serializer = serializers[type]

  if (!serializer) {
    throw new Error(`Cannot serialize type "${type}"`)
  }

  const envelope: StorageEnvelope = {
    type,
    value: serializer.encode(data),
  }

  if (options && Object.keys(options).length > 0) {
    envelope.options = options
  }

  return JSON.stringify(envelope)
}
```

- [ ] **Step 5: Implement decode**

Create `src/serializer/decode.ts`:

```ts
import type { StorageOptions } from '@/types'
import { serializers } from './registry'

export interface DecodedItem {
  value: any
  type: string
  options?: StorageOptions
}

export function decode(raw: string | null): DecodedItem | null | string {
  if (raw === null) return null

  let envelope: any
  try {
    envelope = JSON.parse(raw)
  } catch {
    return raw // Not JSON, return as-is
  }

  if (typeof envelope !== 'object' || envelope === null) {
    return raw
  }

  const serializer = serializers[envelope.type]
  if (!serializer) {
    return envelope // Unrecognized type, return parsed object
  }

  return {
    value: serializer.decode(envelope.value),
    type: envelope.type,
    options: envelope.options,
  }
}
```

- [ ] **Step 6: Run tests to verify all pass**

```bash
npm run test:unit
```

Expected: All serializer tests PASS.

- [ ] **Step 7: Run tests again**

```bash
npm run test:unit
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: implement Serializer with encode/decode and type registry"
```

---

## Task 4: CacheStore

**Files:**
- Create: `src/cache/store.ts`
- Create: `tests/unit/cache-store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/cache-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CacheStore } from '@/cache/store'

describe('CacheStore', () => {
  it('get returns undefined for missing key', () => {
    const cache = new CacheStore()
    expect(cache.get('missing')).toBeUndefined()
  })

  it('set and get', () => {
    const cache = new CacheStore()
    cache.set('key', { value: 'hello', type: 'String' })
    expect(cache.get('key')).toEqual({ value: 'hello', type: 'String' })
  })

  it('delete removes the item', () => {
    const cache = new CacheStore()
    cache.set('key', { value: 42, type: 'Number' })
    cache.delete('key')
    expect(cache.get('key')).toBeUndefined()
  })

  it('has returns correct boolean', () => {
    const cache = new CacheStore()
    expect(cache.has('key')).toBe(false)
    cache.set('key', { value: true, type: 'Boolean' })
    expect(cache.has('key')).toBe(true)
  })

  it('clear removes all items', () => {
    const cache = new CacheStore()
    cache.set('a', { value: 1, type: 'Number' })
    cache.set('b', { value: 2, type: 'Number' })
    cache.clear()
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('object proxy caching', () => {
    const cache = new CacheStore()
    const proxy = { proxied: true }
    cache.setObjectProxy('key', proxy)
    expect(cache.getObjectProxy('key')).toBe(proxy)
  })

  it('deleteObjectProxy', () => {
    const cache = new CacheStore()
    const proxy = { proxied: true }
    cache.setObjectProxy('key', proxy)
    cache.deleteObjectProxy('key')
    expect(cache.getObjectProxy('key')).toBeUndefined()
  })

  it('clear also removes object proxies', () => {
    const cache = new CacheStore()
    cache.setObjectProxy('key', { proxied: true })
    cache.clear()
    expect(cache.getObjectProxy('key')).toBeUndefined()
  })

  it('delete also removes associated object proxy', () => {
    const cache = new CacheStore()
    cache.set('key', { value: {}, type: 'Object' })
    cache.setObjectProxy('key', { proxied: true })
    cache.delete('key')
    expect(cache.getObjectProxy('key')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement CacheStore**

Create `src/cache/store.ts`:

```ts
import type { StorageOptions } from '@/types'

export interface CachedItem {
  value: any
  type: string
  options?: StorageOptions
}

export class CacheStore {
  private items = new Map<string, CachedItem>()
  private objectProxies = new Map<string, object>()

  get(key: string): CachedItem | undefined {
    return this.items.get(key)
  }

  set(key: string, item: CachedItem): void {
    this.items.set(key, item)
  }

  delete(key: string): void {
    this.items.delete(key)
    this.objectProxies.delete(key)
  }

  has(key: string): boolean {
    return this.items.has(key)
  }

  clear(): void {
    this.items.clear()
    this.objectProxies.clear()
  }

  getObjectProxy(key: string): object | undefined {
    return this.objectProxies.get(key)
  }

  setObjectProxy(key: string, proxy: object): void {
    this.objectProxies.set(key, proxy)
  }

  deleteObjectProxy(key: string): void {
    this.objectProxies.delete(key)
  }
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm run test:unit
```

Expected: All CacheStore tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: implement CacheStore with instance-level caching"
```

---

## Task 5: EventEmitter

**Files:**
- Create: `src/events/emitter.ts`
- Create: `tests/unit/emitter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/emitter.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from '@/events/emitter'

describe('EventEmitter', () => {
  it('on registers a listener and emit triggers it', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.on('key', fn)
    emitter.emit('key', 'new', 'old')
    expect(fn).toHaveBeenCalledWith('new', 'old')
  })

  it('emit does not trigger if value has not changed', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.on('key', fn)
    emitter.emit('key', 'same', 'same')
    expect(fn).not.toHaveBeenCalled()
  })

  it('off removes a specific listener', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.on('key', fn)
    emitter.off('key', fn)
    emitter.emit('key', 'new', 'old')
    expect(fn).not.toHaveBeenCalled()
  })

  it('off without fn removes all listeners for a key', () => {
    const emitter = new EventEmitter()
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    emitter.on('key', fn1)
    emitter.on('key', fn2)
    emitter.off('key')
    emitter.emit('key', 'new', 'old')
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).not.toHaveBeenCalled()
  })

  it('offAll removes all listeners', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.on('a', fn)
    emitter.on('b', fn)
    emitter.offAll()
    emitter.emit('a', 1, 0)
    emitter.emit('b', 1, 0)
    expect(fn).not.toHaveBeenCalled()
  })

  it('once fires only once then auto-removes', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.once('key', fn)
    emitter.emit('key', 1, 0)
    emitter.emit('key', 2, 1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(1, 0)
  })

  it('off can remove a once listener by original fn reference', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.once('key', fn)
    emitter.off('key', fn)
    emitter.emit('key', 1, 0)
    expect(fn).not.toHaveBeenCalled()
  })

  it('multiple listeners on same key', () => {
    const emitter = new EventEmitter()
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    emitter.on('key', fn1)
    emitter.on('key', fn2)
    emitter.emit('key', 'val', undefined)
    expect(fn1).toHaveBeenCalledWith('val', undefined)
    expect(fn2).toHaveBeenCalledWith('val', undefined)
  })

  it('getRegisteredKeys returns all keys with listeners', () => {
    const emitter = new EventEmitter()
    emitter.on('a', () => {})
    emitter.on('b', () => {})
    expect(emitter.getRegisteredKeys()).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit
```

Expected: FAIL.

- [ ] **Step 3: Implement EventEmitter**

Create `src/events/emitter.ts`:

```ts
export type Listener = (newValue: any, oldValue: any) => void

interface WrappedListener {
  fn: Listener
  originalFn?: Listener // For once() — stores original so off() can match it
}

export class EventEmitter {
  private listeners = new Map<string, WrappedListener[]>()

  on(key: string, fn: Listener): void {
    const list = this.listeners.get(key) ?? []
    list.push({ fn })
    this.listeners.set(key, list)
  }

  once(key: string, fn: Listener): void {
    const wrapped: Listener = (newValue, oldValue) => {
      this.off(key, fn)
      fn(newValue, oldValue)
    }
    const list = this.listeners.get(key) ?? []
    list.push({ fn: wrapped, originalFn: fn })
    this.listeners.set(key, list)
  }

  off(key: string, fn?: Listener): void {
    if (!fn) {
      this.listeners.delete(key)
      return
    }
    const list = this.listeners.get(key)
    if (!list) return
    const filtered = list.filter(w => w.fn !== fn && w.originalFn !== fn)
    if (filtered.length === 0) {
      this.listeners.delete(key)
    } else {
      this.listeners.set(key, filtered)
    }
  }

  offAll(): void {
    this.listeners.clear()
  }

  /**
   * Emit an event. Only triggers listeners if value has actually changed.
   */
  emit(key: string, newValue: any, oldValue: any): void {
    if (!hasChanged(newValue, oldValue)) return
    const list = this.listeners.get(key)
    if (!list) return
    // Copy to avoid mutation during iteration (once removes itself)
    const snapshot = [...list]
    for (const { fn } of snapshot) {
      fn(newValue, oldValue)
    }
  }

  getRegisteredKeys(): string[] {
    return Array.from(this.listeners.keys())
  }
}

function hasChanged(value: any, oldValue: any): boolean {
  return !Object.is(value, oldValue)
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm run test:unit
```

Expected: All EventEmitter tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: implement EventEmitter with on/off/once/emit"
```

---

## Task 6: Strategy — Sync and Async

**Files:**
- Create: `src/strategy/types.ts`
- Create: `src/strategy/sync-strategy.ts`
- Create: `src/strategy/async-strategy.ts`

- [ ] **Step 1: Create Strategy interface**

Create `src/strategy/types.ts`:

```ts
export interface StorageLikeMinimal {
  getItem(key: string): any
  setItem(key: string, value: string): any
  removeItem(key: string): any
  clear(): any
  key(index: number): any
  length: any
}

export interface StorageStrategy {
  getItem(storage: StorageLikeMinimal, key: string): string | null | Promise<string | null>
  setItem(storage: StorageLikeMinimal, key: string, value: string): void | Promise<void>
  removeItem(storage: StorageLikeMinimal, key: string): void | Promise<void>
  clear(storage: StorageLikeMinimal): void | Promise<void>
  key(storage: StorageLikeMinimal, index: number): string | null | Promise<string | null>
  length(storage: StorageLikeMinimal): number | Promise<number>
}
```

- [ ] **Step 2: Implement SyncStrategy**

Create `src/strategy/sync-strategy.ts`:

```ts
import type { StorageLikeMinimal, StorageStrategy } from './types'

export class SyncStrategy implements StorageStrategy {
  getItem(storage: StorageLikeMinimal, key: string): string | null {
    return storage.getItem(key)
  }

  setItem(storage: StorageLikeMinimal, key: string, value: string): void {
    storage.setItem(key, value)
  }

  removeItem(storage: StorageLikeMinimal, key: string): void {
    storage.removeItem(key)
  }

  clear(storage: StorageLikeMinimal): void {
    storage.clear()
  }

  key(storage: StorageLikeMinimal, index: number): string | null {
    return storage.key(index)
  }

  length(storage: StorageLikeMinimal): number {
    return storage.length
  }
}
```

- [ ] **Step 3: Implement AsyncStrategy**

Create `src/strategy/async-strategy.ts`:

```ts
import type { StorageLikeMinimal, StorageStrategy } from './types'

export class AsyncStrategy implements StorageStrategy {
  async getItem(storage: StorageLikeMinimal, key: string): Promise<string | null> {
    return await storage.getItem(key)
  }

  async setItem(storage: StorageLikeMinimal, key: string, value: string): Promise<void> {
    await storage.setItem(key, value)
  }

  async removeItem(storage: StorageLikeMinimal, key: string): Promise<void> {
    await storage.removeItem(key)
  }

  async clear(storage: StorageLikeMinimal): Promise<void> {
    await storage.clear()
  }

  async key(storage: StorageLikeMinimal, index: number): Promise<string | null> {
    return await storage.key(index)
  }

  async length(storage: StorageLikeMinimal): Promise<number> {
    return await storage.length()
  }
}
```

- [ ] **Step 4: Run unit tests to ensure no regressions**

```bash
npm run test:unit
```

Expected: All existing tests still PASS (strategies are simple wrappers, tested via Operator later).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: implement StorageStrategy with Sync and Async variants"
```

---

## Task 7: StorageBroadcast

**Files:**
- Create: `src/events/broadcast.ts`

- [ ] **Step 1: Implement StorageBroadcast**

Create `src/events/broadcast.ts`:

```ts
export type BroadcastMessage =
  | { type: 'set'; key: string; encoded: string }
  | { type: 'remove'; key: string }
  | { type: 'clear' }

export class StorageBroadcast {
  private channel: BroadcastChannel | null = null

  constructor(name: string | null) {
    if (name && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`stokado:${name}`)
    }
  }

  post(message: BroadcastMessage): void {
    this.channel?.postMessage(message)
  }

  listen(onMessage: (msg: BroadcastMessage) => void): void {
    if (!this.channel) return
    this.channel.onmessage = (ev: MessageEvent) => {
      onMessage(ev.data)
    }
  }

  destroy(): void {
    this.channel?.close()
    this.channel = null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: implement StorageBroadcast for cross-tab sync"
```

---

## Task 8: Utility Functions Update

**Files:**
- Create: `src/utils.ts` (overwrite existing)

- [ ] **Step 1: Rewrite utils.ts — remove pThen, keep type helpers**

Overwrite `src/utils.ts`:

```ts
export type RawType = 'String' | 'Number' | 'BigInt' | 'Boolean' | 'Null' | 'Undefined' | 'Object' | 'Array' | 'Set' | 'Map' | 'Date' | 'RegExp' | 'URL' | 'Function'

export function isPromise<T = any>(val: unknown): val is Promise<T> {
  return (
    val !== null
    && (typeof val === 'object' || typeof val === 'function')
    && typeof (val as any).then === 'function'
    && typeof (val as any).catch === 'function'
  )
}

export function isObject(val: unknown): val is Record<any, any> {
  return val !== null && typeof val === 'object'
}

export function isFunction(val: unknown): val is Function {
  return typeof val === 'function'
}

export function isString(val: unknown): val is string {
  return typeof val === 'string'
}

export function isIntegerKey(key: unknown): boolean {
  return typeof key === 'string'
    && key !== 'NaN'
    && key[0] !== '-'
    && `${Number.parseInt(key, 10)}` === key
}

export function getTypeString(value: unknown): string {
  return Object.prototype.toString.call(value)
}

export function getRawType(value: unknown): RawType {
  return getTypeString(value).slice(8, -1) as RawType
}

export function hasChanged(value: any, oldValue: any): boolean {
  return !Object.is(value, oldValue)
}

export function hasOwn(val: object, key: string | symbol): key is keyof typeof val {
  return Object.prototype.hasOwnProperty.call(val, key)
}

export function formatTime(time: any): number {
  if (time instanceof Date) return time.getTime()
  if (typeof time === 'string') return +time.padEnd(13, '0')
  return time
}

/**
 * Lightweight resolve helper: if val is a Promise, chain fn via .then();
 * otherwise call fn(val) synchronously.
 */
export function resolve<T, R>(val: T | Promise<T>, fn: (v: T) => R | Promise<R>): R | Promise<R> {
  if (isPromise(val)) return (val as Promise<T>).then(fn)
  return fn(val as T)
}
```

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: All PASS (existing tests import from `@/serializer/` and `@/scheduler/` which don't depend on utils changes).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "refactor: rewrite utils — remove pThen, add resolve helper"
```

---

## Task 9: Types Update

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Update types.ts**

Overwrite `src/types.ts`:

```ts
export type RawType = 'String' | 'Number' | 'BigInt' | 'Boolean' | 'Null' | 'Undefined' | 'Object' | 'Array' | 'Set' | 'Map' | 'Date' | 'RegExp' | 'URL' | 'Function'

export interface StorageLike {
  [x: string]: any
  clear: () => any
  getItem: (key: string) => string | null | Promise<string | null>
  key: (key: number) => string | null | Promise<string | null>
  setItem: (key: string, value: any, options?: StorageOptions) => any
  removeItem: (key: string) => any
  length: any
}

export type StorageValue = string | number | bigint | boolean | null | undefined | object

export interface StorageOptions {
  expires?: ExpiresType
  disposable?: boolean
}

export type ExpiresType = string | number | Date

export type Listener = (newValue: any, oldValue: any) => void
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "refactor: update type definitions"
```

---

## Task 10: Nested Object Proxy

**Files:**
- Create: `src/core/proxy-object.ts`
- Create: `tests/unit/proxy-object.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/proxy-object.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createObjectProxy } from '@/core/proxy-object'

describe('createObjectProxy', () => {
  function createMockOperator() {
    return {
      onObjectPropertySet: vi.fn(),
      emitter: {
        emit: vi.fn(),
      },
    }
  }

  it('get returns property value', () => {
    const operator = createMockOperator()
    const proxy = createObjectProxy({ a: 1, b: 2 }, 'key', operator as any)
    expect(proxy.a).toBe(1)
    expect(proxy.b).toBe(2)
  })

  it('set triggers onObjectPropertySet and emits sub-key event', () => {
    const operator = createMockOperator()
    const raw = { name: 'old' }
    const proxy = createObjectProxy(raw, 'user', operator as any)
    proxy.name = 'new'
    expect(raw.name).toBe('new')
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('user', raw)
    expect(operator.emitter.emit).toHaveBeenCalledWith('user.name', 'new', 'old')
  })

  it('delete triggers onObjectPropertySet and emits sub-key event', () => {
    const operator = createMockOperator()
    const raw: any = { name: 'val' }
    const proxy = createObjectProxy(raw, 'key', operator as any)
    delete proxy.name
    expect(raw.name).toBeUndefined()
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('key', raw)
    expect(operator.emitter.emit).toHaveBeenCalledWith('key.name', undefined, 'val')
  })

  it('array push triggers onObjectPropertySet and length event', () => {
    const operator = createMockOperator()
    const raw: any[] = ['a']
    const proxy = createObjectProxy(raw, 'list', operator as any)
    proxy.push('b')
    expect(raw).toEqual(['a', 'b'])
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('list', raw)
    expect(operator.emitter.emit).toHaveBeenCalledWith('list.length', 2, 1)
  })

  it('array pop triggers onObjectPropertySet and length event', () => {
    const operator = createMockOperator()
    const raw = ['a', 'b']
    const proxy = createObjectProxy(raw, 'list', operator as any)
    const result = proxy.pop()
    expect(result).toBe('b')
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('list', raw)
    expect(operator.emitter.emit).toHaveBeenCalledWith('list.length', 1, 2)
  })

  it('array index set triggers sub-key event', () => {
    const operator = createMockOperator()
    const raw = ['old']
    const proxy = createObjectProxy(raw, 'list', operator as any)
    proxy[0] = 'new'
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('list', raw)
    expect(operator.emitter.emit).toHaveBeenCalledWith('list[0]', 'new', 'old')
  })

  it('does not emit if value unchanged', () => {
    const operator = createMockOperator()
    const raw = { name: 'same' }
    const proxy = createObjectProxy(raw, 'key', operator as any)
    proxy.name = 'same'
    expect(operator.onObjectPropertySet).not.toHaveBeenCalled()
    expect(operator.emitter.emit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit
```

Expected: FAIL.

- [ ] **Step 3: Implement createObjectProxy**

Create `src/core/proxy-object.ts`:

```ts
import type { StorageOperator } from './operator'
import { hasChanged, hasOwn, isIntegerKey } from '@/utils'

const ARRAY_MUTATION_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'] as const

export function createObjectProxy(
  rawValue: Record<string, any>,
  key: string,
  operator: StorageOperator,
): any {
  let mutating = false

  const proxy = new Proxy(rawValue, {
    get(target, prop: string, receiver) {
      if (Array.isArray(target) && ARRAY_MUTATION_METHODS.includes(prop as any)) {
        return (...args: any[]) => {
          mutating = true
          const oldLength = target.length
          const result = (target as any)[prop](...args)
          operator.onObjectPropertySet(key, target)
          if (target.length !== oldLength) {
            operator.emitter.emit(`${key}.length`, target.length, oldLength)
          }
          mutating = false
          return result
        }
      }
      return Reflect.get(target, prop, receiver)
    },

    set(target, prop: string, value, receiver) {
      const isArr = Array.isArray(target)
      const arrayLength: number | undefined = isArr ? target.length : undefined
      const oldValue = (target as any)[prop]
      const hadKey = (isArr && isIntegerKey(prop))
        ? Number(prop) < target.length
        : hasOwn(target, prop)

      const result = Reflect.set(target, prop, value, receiver)

      if (result && hasChanged(value, oldValue)) {
        const isIntKey = isArr && isIntegerKey(prop)
        const subKey = isIntKey ? `${key}[${prop}]` : `${key}.${prop}`
        operator.emitter.emit(subKey, value, hadKey ? oldValue : undefined)

        if (!mutating) {
          // Track array[i] = x causing length change
          if (prop !== 'length' && arrayLength !== undefined && target.length !== arrayLength) {
            operator.emitter.emit(`${key}.length`, target.length, arrayLength)
          }
          operator.onObjectPropertySet(key, target)
        }
      }

      return result
    },

    deleteProperty(target, prop: string) {
      const hadKey = hasOwn(target, prop)
      const oldValue = (target as any)[prop]
      const result = Reflect.deleteProperty(target, prop)

      if (result && hadKey) {
        const isArr = Array.isArray(target)
        const isIntKey = isArr && isIntegerKey(prop)
        const subKey = isIntKey ? `${key}[${prop}]` : `${key}.${prop}`
        operator.emitter.emit(subKey, undefined, oldValue)
        operator.onObjectPropertySet(key, target)
      }

      return result
    },
  })

  return proxy
}
```

Note: This file imports `StorageOperator` type. We'll need the Operator to exist (even as a stub) for the import to resolve. For now, use a type-only import. Add this at the top of `src/core/proxy-object.ts`:

Replace the import line with:
```ts
import type { StorageOperator } from './operator'
```

And for tests, the mock works because we're using structural typing (duck typing).

- [ ] **Step 4: Create a minimal operator type stub for the import**

We need the operator type to exist. Create a minimal placeholder at `src/core/operator.ts` that will be fully implemented in the next task:

```ts
import type { EventEmitter } from '@/events/emitter'

// Full implementation in Task 11
export interface StorageOperator {
  emitter: EventEmitter
  onObjectPropertySet(key: string, target: object): void | Promise<void>
}
```

- [ ] **Step 5: Run tests**

```bash
npm run test:unit
```

Expected: All proxy-object tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: implement nested object/array Proxy handler"
```

---

## Task 11: StorageOperator — Core Orchestration

**Files:**
- Modify: `src/core/operator.ts` (replace stub with full implementation)
- Create: `tests/unit/operator.test.ts`

- [ ] **Step 1: Write failing tests for StorageOperator**

Create `tests/unit/operator.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { StorageOperator } from '@/core/operator'
import { SyncScheduler } from '@/scheduler/sync-scheduler'
import { AsyncScheduler } from '@/scheduler/async-scheduler'
import { SyncStrategy } from '@/strategy/sync-strategy'
import { AsyncStrategy } from '@/strategy/async-strategy'
import { CacheStore } from '@/cache/store'
import { EventEmitter } from '@/events/emitter'
import { StorageBroadcast } from '@/events/broadcast'
import { encode } from '@/serializer/encode'

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

describe('StorageOperator - Sync', () => {
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

describe('StorageOperator - Async', () => {
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

describe('StorageOperator - Race Condition (Issue 3.3)', () => {
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit
```

Expected: FAIL — StorageOperator is just an interface stub.

- [ ] **Step 3: Implement StorageOperator**

Replace `src/core/operator.ts` with:

```ts
import type { Scheduler } from '@/scheduler/types'
import type { StorageStrategy } from '@/strategy/types'
import type { StorageOptions } from '@/types'
import type { BroadcastMessage } from '@/events/broadcast'
import { CacheStore } from '@/cache/store'
import { EventEmitter } from '@/events/emitter'
import { StorageBroadcast } from '@/events/broadcast'
import { encode } from '@/serializer/encode'
import { decode, type DecodedItem } from '@/serializer/decode'
import { createObjectProxy } from './proxy-object'
import { resolve, formatTime, getRawType, isObject } from '@/utils'

export class StorageOperator {
  constructor(
    public readonly storage: any,
    private scheduler: Scheduler,
    private strategy: StorageStrategy,
    public readonly cache: CacheStore,
    public readonly emitter: EventEmitter,
    private broadcast: StorageBroadcast,
  ) {}

  get isAsync(): boolean {
    return this.scheduler instanceof Object && 'queues' in (this.scheduler as any)
  }

  getItem(key: string): any {
    return this.scheduler.enqueue(key, () => {
      // Check cache first
      const cached = this.cache.get(key)
      if (cached !== undefined) {
        // Check expiration
        if (this.isExpired(cached.options)) {
          return resolve(this.strategy.removeItem(this.storage, key), () => {
            this.cache.delete(key)
            return null
          })
        }
        // Check disposable — return value once, then remove
        if (cached.options?.disposable) {
          return resolve(this.strategy.removeItem(this.storage, key), () => {
            this.cache.delete(key)
            return this.extractValue(cached, key)
          })
        }
        return this.extractValue(cached, key)
      }

      // Cache miss — read from storage
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return null

        const decoded = decode(raw)
        if (decoded === null || typeof decoded === 'string') return decoded

        const item = decoded as DecodedItem
        this.cache.set(key, { value: item.value, type: item.type, options: item.options })

        // Check expiration
        if (this.isExpired(item.options)) {
          return resolve(this.strategy.removeItem(this.storage, key), () => {
            this.cache.delete(key)
            return null
          })
        }

        // Check disposable
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

  setItem(key: string, value: any, options?: StorageOptions): any {
    return this.scheduler.enqueue(key, () => {
      const oldCached = this.cache.get(key)
      const oldValue = oldCached?.value
      const oldOptions = oldCached?.options ?? {}
      const mergedOptions = options ? { ...oldOptions, ...options } : oldOptions
      const encoded = encode(value, Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined)

      return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
        // Invalidate old object proxy if value is being replaced
        this.cache.deleteObjectProxy(key)
        this.cache.set(key, { value, type: getRawType(value), options: Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined })
        this.emitter.emit(key, value, oldValue)

        // Array length change event
        if (Array.isArray(value) && Array.isArray(oldValue) && value.length !== oldValue.length) {
          this.emitter.emit(`${key}.length`, value.length, oldValue.length)
        }

        this.broadcast.post({ type: 'set', key, encoded })
      })
    })
  }

  removeItem(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const oldCached = this.cache.get(key)
      const oldValue = oldCached?.value

      return resolve(this.strategy.removeItem(this.storage, key), () => {
        this.cache.delete(key)
        this.emitter.emit(key, undefined, oldValue)
        this.broadcast.post({ type: 'remove', key })
      })
    })
  }

  clear(): any {
    const doFlush = this.scheduler.flushAll()
    return resolve(doFlush, () => {
      return resolve(this.strategy.clear(this.storage), () => {
        this.cache.clear()
        this.broadcast.post({ type: 'clear' })
      })
    })
  }

  key(index: number): any {
    return this.strategy.key(this.storage, index)
  }

  get length(): any {
    return this.strategy.length(this.storage)
  }

  // --- Extended operations ---

  setExpires(key: string, expires: any): any {
    const time = formatTime(expires)
    if (time <= Date.now()) {
      return this.removeItem(key)
    }

    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached) {
        const options = { ...cached.options, expires: time }
        const encoded = encode(cached.value, options)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { ...cached, options })
        })
      }
      // No cached item — try reading from storage
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return
        const decoded = decode(raw) as DecodedItem
        if (!decoded || typeof decoded === 'string') return
        const options = { ...decoded.options, expires: time }
        const encoded = encode(decoded.value, options)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { value: decoded.value, type: decoded.type, options })
        })
      })
    })
  }

  getExpires(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached?.options?.expires) {
        const exp = +cached.options.expires
        if (exp <= Date.now()) return undefined
        return new Date(exp)
      }
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return undefined
        const decoded = decode(raw) as DecodedItem
        if (!decoded || typeof decoded === 'string') return undefined
        if (!decoded.options?.expires) return undefined
        const exp = +decoded.options.expires
        if (exp <= Date.now()) return undefined
        return new Date(exp)
      })
    })
  }

  removeExpires(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached?.options?.expires) {
        const { expires, ...restOptions } = cached.options as any
        const newOptions = Object.keys(restOptions).length > 0 ? restOptions : undefined
        const encoded = encode(cached.value, newOptions)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { ...cached, options: newOptions })
        })
      }
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return
        const decoded = decode(raw) as DecodedItem
        if (!decoded || typeof decoded === 'string') return
        if (!decoded.options?.expires) return
        const { expires, ...restOptions } = decoded.options as any
        const newOptions = Object.keys(restOptions).length > 0 ? restOptions : undefined
        const encoded = encode(decoded.value, newOptions)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { value: decoded.value, type: decoded.type, options: newOptions })
        })
      })
    })
  }

  setDisposable(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached) {
        const options = { ...cached.options, disposable: true }
        const encoded = encode(cached.value, options)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { ...cached, options })
        })
      }
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return
        const decoded = decode(raw) as DecodedItem
        if (!decoded || typeof decoded === 'string') return
        const options = { ...decoded.options, disposable: true }
        const encoded = encode(decoded.value, options)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { value: decoded.value, type: decoded.type, options })
        })
      })
    })
  }

  getOptions(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached) return cached.options ?? {}
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return {}
        const decoded = decode(raw) as DecodedItem
        if (!decoded || typeof decoded === 'string') return {}
        return decoded.options ?? {}
      })
    })
  }

  // --- Nested object support ---

  onObjectPropertySet(key: string, target: object): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      // If the key was disposed/removed, don't re-save
      return resolve(this.strategy.getItem(this.storage, key), (current: string | null) => {
        if (current === null) return
        const options = cached?.options
        const encoded = encode(target, options)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { value: target, type: getRawType(target), options })
          this.emitter.emit(key, target, target)
          this.broadcast.post({ type: 'set', key, encoded })
        })
      })
    })
  }

  // --- Broadcast handling ---

  handleBroadcast(msg: BroadcastMessage): void {
    switch (msg.type) {
      case 'set': {
        const decoded = decode(msg.encoded)
        if (decoded && typeof decoded !== 'string') {
          const item = decoded as DecodedItem
          const oldCached = this.cache.get(msg.key)
          this.cache.deleteObjectProxy(msg.key)
          this.cache.set(msg.key, { value: item.value, type: item.type, options: item.options })
          this.emitter.emit(msg.key, item.value, oldCached?.value)
        }
        break
      }
      case 'remove': {
        const oldCached = this.cache.get(msg.key)
        this.cache.delete(msg.key)
        this.emitter.emit(msg.key, undefined, oldCached?.value)
        break
      }
      case 'clear': {
        this.cache.clear()
        break
      }
    }
  }

  // --- Private helpers ---

  private isExpired(options?: StorageOptions): boolean {
    if (!options?.expires) return false
    return new Date(+options.expires).getTime() <= Date.now()
  }

  private extractValue(cached: { value: any; type: string; options?: StorageOptions }, key: string): any {
    if (cached.type === 'Object' || cached.type === 'Array') {
      return this.getOrCreateObjectProxy(key, cached.value)
    }
    return cached.value
  }

  private wrapIfObject(item: DecodedItem, key: string): any {
    if (item.type === 'Object' || item.type === 'Array') {
      return this.getOrCreateObjectProxy(key, item.value)
    }
    return item.value
  }

  private getOrCreateObjectProxy(key: string, raw: object): object {
    let proxy = this.cache.getObjectProxy(key)
    if (!proxy) {
      proxy = createObjectProxy(raw, key, this)
      this.cache.setObjectProxy(key, proxy)
    }
    return proxy
  }
}
```

- [ ] **Step 4: Update proxy-object.ts import**

Update `src/core/proxy-object.ts` to use the concrete class import:

```ts
import type { StorageOperator } from './operator'
```

This is already a type-only import, so no circular runtime dependency.

- [ ] **Step 5: Run tests**

```bash
npm run test:unit
```

Expected: All operator tests PASS (including the race condition test).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: implement StorageOperator — core orchestration with per-key scheduling"
```

---

## Task 12: ProxyHandler and Entry Point

**Files:**
- Create: `src/core/proxy-handler.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement ProxyHandler**

Create `src/core/proxy-handler.ts`:

```ts
import type { StorageOperator } from './operator'
import type { StorageOptions } from '@/types'
import { isFunction, isString } from '@/utils'

export function createProxyHandler(operator: StorageOperator): ProxyHandler<any> {
  return {
    get(target, prop: string) {
      // Standard Storage interface methods
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
        case 'length':
          return operator.length
      }

      // Extended methods
      switch (prop) {
        case 'on':
          return (key: string, fn: any) => operator.emitter.on(key, fn)
        case 'once':
          return (key: string, fn: any) => operator.emitter.once(key, fn)
        case 'off':
          return (key?: string, fn?: any) => {
            if (key === undefined) {
              operator.emitter.offAll()
            } else {
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

      // Native storage properties that aren't keys (e.g. functions on the storage object)
      const nativeValue = target[prop]
      if (nativeValue !== undefined && !isString(nativeValue)) {
        return isFunction(nativeValue) ? nativeValue.bind(target) : nativeValue
      }

      // Property access → getItem
      return operator.getItem(prop)
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

- [ ] **Step 2: Rewrite src/index.ts**

```ts
import type { StorageLike } from '@/types'
import { StorageOperator } from '@/core/operator'
import { createProxyHandler } from '@/core/proxy-handler'
import { SyncScheduler } from '@/scheduler/sync-scheduler'
import { AsyncScheduler } from '@/scheduler/async-scheduler'
import { SyncStrategy } from '@/strategy/sync-strategy'
import { AsyncStrategy } from '@/strategy/async-strategy'
import { CacheStore } from '@/cache/store'
import { EventEmitter } from '@/events/emitter'
import { StorageBroadcast } from '@/events/broadcast'
import { isFunction, isPromise } from '@/utils'

export { StorageOperator } from '@/core/operator'
export type { StorageOptions, StorageLike, Listener } from '@/types'

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
  const broadcastName = name ?? detectName(storage)
  const broadcast = new StorageBroadcast(broadcastName)

  // 4. Assemble Operator
  const operator = new StorageOperator(storage, scheduler, strategy, cache, emitter, broadcast)

  // 5. Create Proxy
  const proxy = new Proxy(storage, createProxyHandler(operator))

  // 6. Start broadcast listener
  broadcast.listen((msg) => operator.handleBroadcast(msg))

  return proxy
}

function validateStorage(storage: StorageLike): void {
  const required = ['getItem', 'setItem', 'removeItem', 'clear']
  for (const method of required) {
    if (!isFunction(storage[method])) {
      throw new Error(`Invalid storage: missing ${method} method`)
    }
  }
}

function detectAsync(storage: StorageLike): boolean {
  const probe = storage.getItem('')
  return isPromise(probe)
}

function detectName(storage: StorageLike): string | null {
  if (typeof window !== 'undefined') {
    if (storage === window.localStorage) return 'local'
    if (storage === window.sessionStorage) return 'session'
  }
  return null
}
```

- [ ] **Step 3: Run unit tests**

```bash
npm run test:unit
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: implement ProxyHandler and createProxyStorage entry point"
```

---

## Task 13: Delete Old Files and Update Imports

**Files:**
- Delete: `src/cache.ts`, `src/shared.ts`, `src/check_expired.ts`, `src/effect.ts`
- Delete: `src/proxy/` (entire directory)
- Delete: `src/extends/watch.ts`, `src/extends/disposable.ts`, `src/extends/expires.ts`, `src/extends/options.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Remove old source files**

```bash
rm -f src/cache.ts src/shared.ts src/check_expired.ts src/effect.ts
rm -rf src/proxy
rm -rf src/extends
```

- [ ] **Step 2: Update tsconfig.json include paths**

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["DOM", "ESNEXT"],
    "baseUrl": "./src",
    "rootDir": ".",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "paths": {
      "@/*": ["*"]
    },
    "resolveJsonModule": true,
    "strict": true,
    "strictNullChecks": true,
    "noEmit": true,
    "esModuleInterop": true,
    "verbatimModuleSyntax": true,
    "skipDefaultLibCheck": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: No errors. Fix any remaining import issues if needed.

- [ ] **Step 4: Run unit tests**

```bash
npm run test:unit
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor: remove old source files and update tsconfig"
```

---

## Task 14: Build and E2E Test Verification

**Files:**
- Modify: `rollup.config.js` (if needed)
- Modify: `tests/` E2E test files (if import paths need updating)

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: Builds successfully. If there are errors, fix import paths or rollup config. The entry point is still `src/index.ts` which exports `createProxyStorage`, so rollup should work unchanged.

- [ ] **Step 2: Run E2E tests**

```bash
npm test
```

This runs `rollup -c --environment BUILD:test && npx playwright test`.

Expected: All existing Playwright E2E tests PASS.

- [ ] **Step 3: Fix any failing E2E tests**

If tests fail, debug and fix. Common issues:
- The `length` property on localForage is a function (`length()`) vs property (`length`) — verify AsyncStrategy handles this
- The `setDisposable` API takes `(key)` not `(key, value)` — verify ProxyHandler passes correctly
- Cross-tab broadcast message format may differ — verify BroadcastMessage structure matches what tests expect

Iterate until all E2E tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: ensure build and all E2E tests pass after refactor"
```

---

## Task 15: Additional Unit Tests for Race Conditions

**Files:**
- Modify: `tests/unit/operator.test.ts`

- [ ] **Step 1: Add comprehensive race condition tests**

Append to `tests/unit/operator.test.ts`:

```ts
describe('StorageOperator - Complex Race Conditions', () => {
  it('multiple rapid setItem on same key preserves last value', async () => {
    const op = createAsyncOperator()
    const p1 = op.setItem('key', 'first')
    const p2 = op.setItem('key', 'second')
    const p3 = op.setItem('key', 'third')
    await Promise.all([p1, p2, p3])
    expect(await op.getItem('key')).toBe('third')
  })

  it('setDisposable then getItem returns value once', async () => {
    const op = createAsyncOperator()
    await op.setItem('key', 'disposable-val')
    await op.setDisposable('key')
    const first = await op.getItem('key')
    const second = await op.getItem('key')
    expect(first).toBe('disposable-val')
    expect(second).toBeNull()
  })

  it('interleaved operations on different keys are independent', async () => {
    const op = createAsyncOperator()
    const setA = op.setItem('a', 'alpha')
    const setB = op.setItem('b', 'beta')
    await Promise.all([setA, setB])
    expect(await op.getItem('a')).toBe('alpha')
    expect(await op.getItem('b')).toBe('beta')
  })

  it('clear after pending operations waits correctly', async () => {
    const op = createAsyncOperator()
    const set1 = op.setItem('x', 'val')
    const clearP = op.clear()
    await set1
    await clearP
    expect(await op.getItem('x')).toBeNull()
  })
})
```

- [ ] **Step 2: Run all unit tests**

```bash
npm run test:unit
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test: add comprehensive race condition unit tests"
```

---

## Task 16: Final Cleanup and Verification

- [ ] **Step 1: Run linting**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 2: Run type check**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:unit && npm test
```

Expected: All unit tests and E2E tests PASS.

- [ ] **Step 4: Verify build output**

```bash
npm run build && ls -la dist/
```

Expected: `stokado.mjs`, `stokado.cjs`, `stokado.js`, `stokado.min.js`, `stokado.d.ts` all present.

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "chore: final cleanup — lint, typecheck, all tests green"
```

---

## Summary of Commits

| # | Message |
|---|---------|
| 1 | `chore: add vitest and create new module directory structure` |
| 2 | `feat: implement Scheduler interface with Sync and Async variants` |
| 3 | `feat: implement Serializer with encode/decode and type registry` |
| 4 | `feat: implement CacheStore with instance-level caching` |
| 5 | `feat: implement EventEmitter with on/off/once/emit` |
| 6 | `feat: implement StorageStrategy with Sync and Async variants` |
| 7 | `feat: implement StorageBroadcast for cross-tab sync` |
| 8 | `refactor: rewrite utils — remove pThen, add resolve helper` |
| 9 | `refactor: update type definitions` |
| 10 | `feat: implement nested object/array Proxy handler` |
| 11 | `feat: implement StorageOperator — core orchestration with per-key scheduling` |
| 12 | `feat: implement ProxyHandler and createProxyStorage entry point` |
| 13 | `refactor: remove old source files and update tsconfig` |
| 14 | `fix: ensure build and all E2E tests pass after refactor` |
| 15 | `test: add comprehensive race condition unit tests` |
| 16 | `chore: final cleanup — lint, typecheck, all tests green` |
