# Storage Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add preset StorageLike adapters for Cookie, WeChat, Douyin, Alipay, uni-app, React Native, and Node.js, enabling direct use with `createProxyStorage`.

**Architecture:** Generic mini-program adapter shared by WeChat/Douyin/uni-app, separate Alipay adapter (different API signature), independent Cookie/React Native/Node.js adapters. Each preset exported via sub-path for tree-shaking.

**Tech Stack:** TypeScript, Rollup, Vitest

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/presets/node.ts` | In-memory Map-based SyncStorageLike |
| Create | `src/presets/cookie.ts` | Cookie-based SyncStorageLike |
| Create | `src/presets/mini-program.ts` | Generic mini-program factory + types |
| Create | `src/presets/wechat.ts` | WeChat convenience wrapper |
| Create | `src/presets/douyin.ts` | Douyin convenience wrapper |
| Create | `src/presets/uni-app.ts` | uni-app convenience wrapper |
| Create | `src/presets/alipay.ts` | Alipay adapter + types |
| Create | `src/presets/react-native.ts` | React Native factory + types |
| Modify | `package.json` | Add sub-path exports |
| Modify | `rollup.config.js` | Add preset entry points |
| Create | `tests/unit/presets/node.test.ts` | Node memory storage tests |
| Create | `tests/unit/presets/cookie.test.ts` | Cookie adapter tests |
| Create | `tests/unit/presets/mini-program.test.ts` | Generic mini-program tests |
| Create | `tests/unit/presets/alipay.test.ts` | Alipay adapter tests |
| Create | `tests/unit/presets/react-native.test.ts` | React Native adapter tests |

---

### Task 1: Node.js Memory Storage

**Files:**
- Create: `src/presets/node.ts`
- Create: `tests/unit/presets/node.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import type { SyncStorageLike } from '@/types'

describe('memoryStorage', () => {
  it('should implement SyncStorageLike', () => {
    const { memoryStorage } = await import('@/presets/node')
    const storage: SyncStorageLike = memoryStorage
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('number')
  })

  it('should set and get items', () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.setItem('foo', 'bar')
    expect(memoryStorage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.clear()
    expect(memoryStorage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.setItem('foo', 'bar')
    memoryStorage.removeItem('foo')
    expect(memoryStorage.getItem('foo')).toBeNull()
  })

  it('should clear all items', () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.setItem('a', '1')
    memoryStorage.setItem('b', '2')
    memoryStorage.clear()
    expect(memoryStorage.length).toBe(0)
  })

  it('should return key by index', () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.clear()
    memoryStorage.setItem('first', '1')
    memoryStorage.setItem('second', '2')
    expect(memoryStorage.key(0)).toBe('first')
    expect(memoryStorage.key(1)).toBe('second')
    expect(memoryStorage.key(2)).toBeNull()
  })

  it('should report correct length', () => {
    const { memoryStorage } = await import('@/presets/node')
    memoryStorage.clear()
    memoryStorage.setItem('a', '1')
    memoryStorage.setItem('b', '2')
    expect(memoryStorage.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/presets/node.test.ts`
Expected: FAIL — module `@/presets/node` not found

- [ ] **Step 3: Write minimal implementation**

```ts
import type { SyncStorageLike } from '@/types'

const map = new Map<string, string>()

export const memoryStorage: SyncStorageLike = {
  getItem(key: string): string | null {
    return map.get(key) ?? null
  },
  setItem(key: string, value: any): void {
    map.set(key, value)
  },
  removeItem(key: string): void {
    map.delete(key)
  },
  clear(): void {
    map.clear()
  },
  key(index: number): string | null {
    return [...map.keys()][index] ?? null
  },
  get length(): number {
    return map.size
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/presets/node.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presets/node.ts tests/unit/presets/node.test.ts
git commit -m "feat: add memoryStorage preset for Node.js"
```

---

### Task 2: Cookie Adapter

**Files:**
- Create: `src/presets/cookie.ts`
- Create: `tests/unit/presets/cookie.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncStorageLike } from '@/types'

let cookieStore: Record<string, string> = {}

vi.stubGlobal('document', {
  get cookie() {
    return Object.entries(cookieStore)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('; ')
  },
  set cookie(val: string) {
    const [pair] = val.split(';')
    const eqIndex = pair.indexOf('=')
    if (eqIndex === -1) return
    const key = decodeURIComponent(pair.slice(0, eqIndex).trim())
    const value = decodeURIComponent(pair.slice(eqIndex + 1).trim())
    if (value === '' && val.includes('expires=')) {
      delete cookieStore[key]
    } else {
      cookieStore[key] = value
    }
  },
})

describe('cookieStorage', () => {
  beforeEach(() => {
    cookieStore = {}
  })

  it('should implement SyncStorageLike', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    const storage: SyncStorageLike = cookieStorage
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('number')
  })

  it('should set and get items', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('foo', 'bar')
    expect(cookieStorage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    expect(cookieStorage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('foo', 'bar')
    cookieStorage.removeItem('foo')
    expect(cookieStorage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('a', '1')
    cookieStorage.setItem('b', '2')
    cookieStorage.clear()
    expect(cookieStorage.length).toBe(0)
  })

  it('should return key by index', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('first', '1')
    cookieStorage.setItem('second', '2')
    const keys = [cookieStorage.key(0), cookieStorage.key(1)]
    expect(keys).toContain('first')
    expect(keys).toContain('second')
    expect(cookieStorage.key(2)).toBeNull()
  })

  it('should report correct length', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('a', '1')
    cookieStorage.setItem('b', '2')
    expect(cookieStorage.length).toBe(2)
  })

  it('should handle special characters', async () => {
    const { cookieStorage } = await import('@/presets/cookie')
    cookieStorage.setItem('key with spaces', 'value=with=equals')
    expect(cookieStorage.getItem('key with spaces')).toBe('value=with=equals')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/presets/cookie.test.ts`
Expected: FAIL — module `@/presets/cookie` not found

- [ ] **Step 3: Write minimal implementation**

```ts
import type { SyncStorageLike } from '@/types'

function parseCookies(): Map<string, string> {
  const map = new Map<string, string>()
  if (!document.cookie) return map
  document.cookie.split(';').forEach((cookie) => {
    const eqIndex = cookie.indexOf('=')
    if (eqIndex === -1) return
    const key = decodeURIComponent(cookie.slice(0, eqIndex).trim())
    const value = decodeURIComponent(cookie.slice(eqIndex + 1).trim())
    map.set(key, value)
  })
  return map
}

export const cookieStorage: SyncStorageLike = {
  getItem(key: string): string | null {
    return parseCookies().get(key) ?? null
  },
  setItem(key: string, value: any): void {
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  },
  removeItem(key: string): void {
    document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  },
  clear(): void {
    const keys = [...parseCookies().keys()]
    for (const key of keys) {
      document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    }
  },
  key(index: number): string | null {
    return [...parseCookies().keys()][index] ?? null
  },
  get length(): number {
    return parseCookies().size
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/presets/cookie.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presets/cookie.ts tests/unit/presets/cookie.test.ts
git commit -m "feat: add cookieStorage preset"
```

---

### Task 3: Generic Mini-Program Adapter

**Files:**
- Create: `src/presets/mini-program.ts`
- Create: `tests/unit/presets/mini-program.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { SyncStorageLike, AsyncStorageLike } from '@/types'

function createMockMiniProgramAPI() {
  const store = new Map<string, any>()
  return {
    getStorageSync(key: string) {
      return store.get(key) ?? ''
    },
    setStorageSync(key: string, data: any) {
      store.set(key, data)
    },
    removeStorageSync(key: string) {
      store.delete(key)
    },
    clearStorageSync() {
      store.clear()
    },
    getStorageInfoSync() {
      return { keys: [...store.keys()], currentSize: 0, limitSize: 0 }
    },
    async getStorage(options: { key: string }) {
      const data = store.get(options.key)
      return { data: data ?? '' }
    },
    async setStorage(options: { key: string; data: any }) {
      store.set(options.key, options.data)
    },
    async removeStorage(options: { key: string }) {
      store.delete(options.key)
    },
    async clearStorage() {
      store.clear()
    },
    async getStorageInfo() {
      return { keys: [...store.keys()], currentSize: 0, limitSize: 0 }
    },
  }
}

describe('createMiniProgramStorage', () => {
  let api: ReturnType<typeof createMockMiniProgramAPI>

  beforeEach(() => {
    api = createMockMiniProgramAPI()
  })

  it('should implement SyncStorageLike', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage: SyncStorageLike = createMiniProgramStorage(api)
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('number')
  })

  it('should set and get items', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    storage.setItem('foo', 'bar')
    expect(storage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    expect(storage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    storage.setItem('foo', 'bar')
    storage.removeItem('foo')
    expect(storage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    storage.clear()
    expect(storage.length).toBe(0)
  })

  it('should return key by index', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    storage.setItem('first', '1')
    storage.setItem('second', '2')
    expect(storage.key(0)).toBe('first')
    expect(storage.key(1)).toBe('second')
    expect(storage.key(2)).toBeNull()
  })

  it('should report correct length', async () => {
    const { createMiniProgramStorage } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorage(api)
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    expect(storage.length).toBe(2)
  })
})

describe('createMiniProgramStorageAsync', () => {
  let api: ReturnType<typeof createMockMiniProgramAPI>

  beforeEach(() => {
    api = createMockMiniProgramAPI()
  })

  it('should implement AsyncStorageLike', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage: AsyncStorageLike = createMiniProgramStorageAsync(api)
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('function')
  })

  it('should set and get items', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    await storage.setItem('foo', 'bar')
    expect(await storage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    expect(await storage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    await storage.setItem('foo', 'bar')
    await storage.removeItem('foo')
    expect(await storage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    await storage.setItem('a', '1')
    await storage.setItem('b', '2')
    await storage.clear()
    expect(await storage.length()).toBe(0)
  })

  it('should return key by index', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    await storage.setItem('first', '1')
    await storage.setItem('second', '2')
    expect(await storage.key(0)).toBe('first')
    expect(await storage.key(1)).toBe('second')
    expect(await storage.key(2)).toBeNull()
  })

  it('should report correct length', async () => {
    const { createMiniProgramStorageAsync } = await import('@/presets/mini-program')
    const storage = createMiniProgramStorageAsync(api)
    await storage.setItem('a', '1')
    await storage.setItem('b', '2')
    expect(await storage.length()).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/presets/mini-program.test.ts`
Expected: FAIL — module `@/presets/mini-program` not found

- [ ] **Step 3: Write minimal implementation**

```ts
import type { AsyncStorageLike, SyncStorageLike } from '@/types'

export interface MiniProgramSyncAPI {
  getStorageSync(key: string): any
  setStorageSync(key: string, data: any): void
  removeStorageSync(key: string): void
  clearStorageSync(): void
  getStorageInfoSync(): { keys: string[]; currentSize: number; limitSize: number }
}

export interface MiniProgramAsyncAPI {
  getStorage(options: { key: string }): Promise<{ data: any }>
  setStorage(options: { key: string; data: any }): Promise<void>
  removeStorage(options: { key: string }): Promise<void>
  clearStorage(): Promise<void>
  getStorageInfo(): Promise<{ keys: string[]; currentSize: number; limitSize: number }>
}

export function createMiniProgramStorage(api: MiniProgramSyncAPI): SyncStorageLike {
  return {
    getItem(key: string): string | null {
      const value = api.getStorageSync(key)
      return value === '' ? null : value
    },
    setItem(key: string, value: any): void {
      api.setStorageSync(key, value)
    },
    removeItem(key: string): void {
      api.removeStorageSync(key)
    },
    clear(): void {
      api.clearStorageSync()
    },
    key(index: number): string | null {
      return api.getStorageInfoSync().keys[index] ?? null
    },
    get length(): number {
      return api.getStorageInfoSync().keys.length
    },
  }
}

export function createMiniProgramStorageAsync(api: MiniProgramAsyncAPI): AsyncStorageLike {
  return {
    async getItem(key: string): Promise<string | null> {
      const { data } = await api.getStorage({ key })
      return data === '' ? null : data
    },
    async setItem(key: string, value: any): Promise<void> {
      await api.setStorage({ key, data: value })
    },
    async removeItem(key: string): Promise<void> {
      await api.removeStorage({ key })
    },
    async clear(): Promise<void> {
      await api.clearStorage()
    },
    async key(index: number): Promise<string | null> {
      const { keys } = await api.getStorageInfo()
      return keys[index] ?? null
    },
    async length(): Promise<number> {
      const { keys } = await api.getStorageInfo()
      return keys.length
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/presets/mini-program.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presets/mini-program.ts tests/unit/presets/mini-program.test.ts
git commit -m "feat: add generic mini-program storage adapter"
```

---

### Task 4: WeChat Preset Wrapper

**Files:**
- Create: `src/presets/wechat.ts`

- [ ] **Step 1: Write implementation**

```ts
import type { AsyncStorageLike, SyncStorageLike } from '@/types'
import { createMiniProgramStorage, createMiniProgramStorageAsync } from '@/presets/mini-program'

declare const wx: {
  getStorageSync(key: string): any
  setStorageSync(key: string, data: any): void
  removeStorageSync(key: string): void
  clearStorageSync(): void
  getStorageInfoSync(): { keys: string[]; currentSize: number; limitSize: number }
  getStorage(options: { key: string }): Promise<{ data: any }>
  setStorage(options: { key: string; data: any }): Promise<void>
  removeStorage(options: { key: string }): Promise<void>
  clearStorage(): Promise<void>
  getStorageInfo(): Promise<{ keys: string[]; currentSize: number; limitSize: number }>
}

export const wechatStorage: SyncStorageLike = createMiniProgramStorage(wx)
export const wechatStorageAsync: AsyncStorageLike = createMiniProgramStorageAsync(wx)
export { createMiniProgramStorage, createMiniProgramStorageAsync }
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add src/presets/wechat.ts
git commit -m "feat: add WeChat mini-program preset"
```

---

### Task 5: Douyin Preset Wrapper

**Files:**
- Create: `src/presets/douyin.ts`

- [ ] **Step 1: Write implementation**

```ts
import type { AsyncStorageLike, SyncStorageLike } from '@/types'
import { createMiniProgramStorage, createMiniProgramStorageAsync } from '@/presets/mini-program'

declare const tt: {
  getStorageSync(key: string): any
  setStorageSync(key: string, data: any): void
  removeStorageSync(key: string): void
  clearStorageSync(): void
  getStorageInfoSync(): { keys: string[]; currentSize: number; limitSize: number }
  getStorage(options: { key: string }): Promise<{ data: any }>
  setStorage(options: { key: string; data: any }): Promise<void>
  removeStorage(options: { key: string }): Promise<void>
  clearStorage(): Promise<void>
  getStorageInfo(): Promise<{ keys: string[]; currentSize: number; limitSize: number }>
}

export const douyinStorage: SyncStorageLike = createMiniProgramStorage(tt)
export const douyinStorageAsync: AsyncStorageLike = createMiniProgramStorageAsync(tt)
export { createMiniProgramStorage, createMiniProgramStorageAsync }
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/presets/douyin.ts
git commit -m "feat: add Douyin mini-program preset"
```

---

### Task 6: uni-app Preset Wrapper

**Files:**
- Create: `src/presets/uni-app.ts`

- [ ] **Step 1: Write implementation**

```ts
import type { AsyncStorageLike, SyncStorageLike } from '@/types'
import { createMiniProgramStorage, createMiniProgramStorageAsync } from '@/presets/mini-program'

declare const uni: {
  getStorageSync(key: string): any
  setStorageSync(key: string, data: any): void
  removeStorageSync(key: string): void
  clearStorageSync(): void
  getStorageInfoSync(): { keys: string[]; currentSize: number; limitSize: number }
  getStorage(options: { key: string }): Promise<{ data: any }>
  setStorage(options: { key: string; data: any }): Promise<void>
  removeStorage(options: { key: string }): Promise<void>
  clearStorage(): Promise<void>
  getStorageInfo(): Promise<{ keys: string[]; currentSize: number; limitSize: number }>
}

export const uniStorage: SyncStorageLike = createMiniProgramStorage(uni)
export const uniStorageAsync: AsyncStorageLike = createMiniProgramStorageAsync(uni)
export { createMiniProgramStorage, createMiniProgramStorageAsync }
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/presets/uni-app.ts
git commit -m "feat: add uni-app preset"
```

---

### Task 7: Alipay Adapter

**Files:**
- Create: `src/presets/alipay.ts`
- Create: `tests/unit/presets/alipay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { SyncStorageLike, AsyncStorageLike } from '@/types'

function createMockAlipayAPI() {
  const store = new Map<string, any>()
  return {
    getStorageSync(options: { key: string }) {
      const data = store.get(options.key)
      return { data: data !== undefined ? data : null }
    },
    setStorageSync(options: { key: string; data: any }) {
      store.set(options.key, options.data)
    },
    removeStorageSync(options: { key: string }) {
      store.delete(options.key)
    },
    clearStorageSync() {
      store.clear()
    },
    getStorageInfoSync() {
      return { keys: [...store.keys()], currentSize: 0, limitSize: 0 }
    },
    async getStorage(options: { key: string }) {
      const data = store.get(options.key)
      return { data: data !== undefined ? data : null }
    },
    async setStorage(options: { key: string; data: any }) {
      store.set(options.key, options.data)
    },
    async removeStorage(options: { key: string }) {
      store.delete(options.key)
    },
    async clearStorage() {
      store.clear()
    },
    async getStorageInfo() {
      return { keys: [...store.keys()], currentSize: 0, limitSize: 0 }
    },
  }
}

describe('alipayStorage', () => {
  let api: ReturnType<typeof createMockAlipayAPI>

  beforeEach(() => {
    api = createMockAlipayAPI()
  })

  it('should implement SyncStorageLike', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage: SyncStorageLike = createAlipayStorage(api)
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('number')
  })

  it('should set and get items', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage = createAlipayStorage(api)
    storage.setItem('foo', 'bar')
    expect(storage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage = createAlipayStorage(api)
    expect(storage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage = createAlipayStorage(api)
    storage.setItem('foo', 'bar')
    storage.removeItem('foo')
    expect(storage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage = createAlipayStorage(api)
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    storage.clear()
    expect(storage.length).toBe(0)
  })

  it('should return key by index', async () => {
    const { createAlipayStorage } = await import('@/presets/alipay')
    const storage = createAlipayStorage(api)
    storage.setItem('first', '1')
    storage.setItem('second', '2')
    expect(storage.key(0)).toBe('first')
    expect(storage.key(1)).toBe('second')
    expect(storage.key(2)).toBeNull()
  })
})

describe('alipayStorageAsync', () => {
  let api: ReturnType<typeof createMockAlipayAPI>

  beforeEach(() => {
    api = createMockAlipayAPI()
  })

  it('should implement AsyncStorageLike', async () => {
    const { createAlipayStorageAsync } = await import('@/presets/alipay')
    const storage: AsyncStorageLike = createAlipayStorageAsync(api)
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('function')
  })

  it('should set and get items', async () => {
    const { createAlipayStorageAsync } = await import('@/presets/alipay')
    const storage = createAlipayStorageAsync(api)
    await storage.setItem('foo', 'bar')
    expect(await storage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { createAlipayStorageAsync } = await import('@/presets/alipay')
    const storage = createAlipayStorageAsync(api)
    expect(await storage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { createAlipayStorageAsync } = await import('@/presets/alipay')
    const storage = createAlipayStorageAsync(api)
    await storage.setItem('foo', 'bar')
    await storage.removeItem('foo')
    expect(await storage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { createAlipayStorageAsync } = await import('@/presets/alipay')
    const storage = createAlipayStorageAsync(api)
    await storage.setItem('a', '1')
    await storage.setItem('b', '2')
    await storage.clear()
    expect(await storage.length()).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/presets/alipay.test.ts`
Expected: FAIL — module `@/presets/alipay` not found

- [ ] **Step 3: Write minimal implementation**

```ts
import type { AsyncStorageLike, SyncStorageLike } from '@/types'

export interface AlipaySyncAPI {
  getStorageSync(options: { key: string }): { data: any }
  setStorageSync(options: { key: string; data: any }): void
  removeStorageSync(options: { key: string }): void
  clearStorageSync(): void
  getStorageInfoSync(): { keys: string[]; currentSize: number; limitSize: number }
}

export interface AlipayAsyncAPI {
  getStorage(options: { key: string }): Promise<{ data: any }>
  setStorage(options: { key: string; data: any }): Promise<void>
  removeStorage(options: { key: string }): Promise<void>
  clearStorage(): Promise<void>
  getStorageInfo(): Promise<{ keys: string[]; currentSize: number; limitSize: number }>
}

declare const my: AlipaySyncAPI & AlipayAsyncAPI

export function createAlipayStorage(api: AlipaySyncAPI): SyncStorageLike {
  return {
    getItem(key: string): string | null {
      const { data } = api.getStorageSync({ key })
      return data ?? null
    },
    setItem(key: string, value: any): void {
      api.setStorageSync({ key, data: value })
    },
    removeItem(key: string): void {
      api.removeStorageSync({ key })
    },
    clear(): void {
      api.clearStorageSync()
    },
    key(index: number): string | null {
      return api.getStorageInfoSync().keys[index] ?? null
    },
    get length(): number {
      return api.getStorageInfoSync().keys.length
    },
  }
}

export function createAlipayStorageAsync(api: AlipayAsyncAPI): AsyncStorageLike {
  return {
    async getItem(key: string): Promise<string | null> {
      const { data } = await api.getStorage({ key })
      return data ?? null
    },
    async setItem(key: string, value: any): Promise<void> {
      await api.setStorage({ key, data: value })
    },
    async removeItem(key: string): Promise<void> {
      await api.removeStorage({ key })
    },
    async clear(): Promise<void> {
      await api.clearStorage()
    },
    async key(index: number): Promise<string | null> {
      const { keys } = await api.getStorageInfo()
      return keys[index] ?? null
    },
    async length(): Promise<number> {
      const { keys } = await api.getStorageInfo()
      return keys.length
    },
  }
}

export const alipayStorage: SyncStorageLike = createAlipayStorage(my)
export const alipayStorageAsync: AsyncStorageLike = createAlipayStorageAsync(my)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/presets/alipay.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presets/alipay.ts tests/unit/presets/alipay.test.ts
git commit -m "feat: add Alipay mini-program preset"
```

---

### Task 8: React Native Adapter

**Files:**
- Create: `src/presets/react-native.ts`
- Create: `tests/unit/presets/react-native.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { AsyncStorageLike } from '@/types'

function createMockAsyncStorage() {
  const store = new Map<string, string>()
  return {
    async getItem(key: string): Promise<string | null> {
      return store.get(key) ?? null
    },
    async setItem(key: string, value: string): Promise<void> {
      store.set(key, value)
    },
    async removeItem(key: string): Promise<void> {
      store.delete(key)
    },
    async clear(): Promise<void> {
      store.clear()
    },
    async getAllKeys(): Promise<string[]> {
      return [...store.keys()]
    },
  }
}

describe('createReactNativeStorage', () => {
  let asyncStorage: ReturnType<typeof createMockAsyncStorage>

  beforeEach(() => {
    asyncStorage = createMockAsyncStorage()
  })

  it('should implement AsyncStorageLike', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage: AsyncStorageLike = createReactNativeStorage(asyncStorage)
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
    expect(storage.clear).toBeTypeOf('function')
    expect(storage.key).toBeTypeOf('function')
    expect(storage.length).toBeTypeOf('function')
  })

  it('should set and get items', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    await storage.setItem('foo', 'bar')
    expect(await storage.getItem('foo')).toBe('bar')
  })

  it('should return null for missing keys', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    expect(await storage.getItem('nonexistent')).toBeNull()
  })

  it('should remove items', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    await storage.setItem('foo', 'bar')
    await storage.removeItem('foo')
    expect(await storage.getItem('foo')).toBeNull()
  })

  it('should clear all items', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    await storage.setItem('a', '1')
    await storage.setItem('b', '2')
    await storage.clear()
    expect(await storage.length()).toBe(0)
  })

  it('should return key by index', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    await storage.setItem('first', '1')
    await storage.setItem('second', '2')
    expect(await storage.key(0)).toBe('first')
    expect(await storage.key(1)).toBe('second')
    expect(await storage.key(2)).toBeNull()
  })

  it('should report correct length', async () => {
    const { createReactNativeStorage } = await import('@/presets/react-native')
    const storage = createReactNativeStorage(asyncStorage)
    await storage.setItem('a', '1')
    await storage.setItem('b', '2')
    expect(await storage.length()).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/presets/react-native.test.ts`
Expected: FAIL — module `@/presets/react-native` not found

- [ ] **Step 3: Write minimal implementation**

```ts
import type { AsyncStorageLike } from '@/types'

export interface ReactNativeAsyncStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
  getAllKeys(): Promise<string[]>
}

export function createReactNativeStorage(asyncStorage: ReactNativeAsyncStorage): AsyncStorageLike {
  return {
    async getItem(key: string): Promise<string | null> {
      return asyncStorage.getItem(key)
    },
    async setItem(key: string, value: any): Promise<void> {
      await asyncStorage.setItem(key, value)
    },
    async removeItem(key: string): Promise<void> {
      await asyncStorage.removeItem(key)
    },
    async clear(): Promise<void> {
      await asyncStorage.clear()
    },
    async key(index: number): Promise<string | null> {
      const keys = await asyncStorage.getAllKeys()
      return keys[index] ?? null
    },
    async length(): Promise<number> {
      const keys = await asyncStorage.getAllKeys()
      return keys.length
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/presets/react-native.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presets/react-native.ts tests/unit/presets/react-native.test.ts
git commit -m "feat: add React Native storage preset"
```

---

### Task 9: Build Configuration

**Files:**
- Modify: `package.json`
- Modify: `rollup.config.js`

- [ ] **Step 1: Update package.json exports**

Add sub-path exports for each preset in `package.json`. The existing `"."` entry stays unchanged. Add the following entries after it:

```json
"./presets/cookie": {
  "types": "./dist/presets/cookie.d.ts",
  "import": "./dist/presets/cookie.mjs",
  "require": "./dist/presets/cookie.cjs"
},
"./presets/wechat": {
  "types": "./dist/presets/wechat.d.ts",
  "import": "./dist/presets/wechat.mjs",
  "require": "./dist/presets/wechat.cjs"
},
"./presets/douyin": {
  "types": "./dist/presets/douyin.d.ts",
  "import": "./dist/presets/douyin.mjs",
  "require": "./dist/presets/douyin.cjs"
},
"./presets/alipay": {
  "types": "./dist/presets/alipay.d.ts",
  "import": "./dist/presets/alipay.mjs",
  "require": "./dist/presets/alipay.cjs"
},
"./presets/uni-app": {
  "types": "./dist/presets/uni-app.d.ts",
  "import": "./dist/presets/uni-app.mjs",
  "require": "./dist/presets/uni-app.cjs"
},
"./presets/react-native": {
  "types": "./dist/presets/react-native.d.ts",
  "import": "./dist/presets/react-native.mjs",
  "require": "./dist/presets/react-native.cjs"
},
"./presets/node": {
  "types": "./dist/presets/node.d.ts",
  "import": "./dist/presets/node.mjs",
  "require": "./dist/presets/node.cjs"
}
```

- [ ] **Step 2: Update rollup.config.js**

Add preset entry points to the rollup config. Each preset needs its own input and generates `.mjs`, `.cjs`, and `.d.ts` outputs. Insert the following logic after the existing `configs.push(...)` for the main entry:

```js
const presetEntries = [
  'cookie',
  'wechat',
  'douyin',
  'alipay',
  'uni-app',
  'react-native',
  'node',
]

if (process.env.BUILD === 'prod') {
  for (const preset of presetEntries) {
    const presetInput = path.resolve(__dirname, `src/presets/${preset}.ts`)
    configs.push({
      input: presetInput,
      output: [
        {
          file: `dist/presets/${preset}.mjs`,
          format: 'es',
        },
        {
          file: `dist/presets/${preset}.cjs`,
          format: 'cjs',
        },
      ],
      plugins: [pluginEsbuild, typescript({ declaration: false }), pluginAlias, nodeResolve()],
    }, {
      input: presetInput,
      output: {
        file: `dist/presets/${preset}.d.ts`,
        format: 'es',
      },
      plugins: [dts(), pluginAlias],
    })
  }
}
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds with all preset files generated in `dist/presets/`

- [ ] **Step 4: Commit**

```bash
git add package.json rollup.config.js
git commit -m "feat: add preset sub-path exports and build config"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 4: Run full build**

Run: `npm run build`
Expected: Build succeeds with all outputs in `dist/`

- [ ] **Step 5: Verify dist output structure**

Run: `ls -la dist/presets/`
Expected: All 7 preset directories with `.mjs`, `.cjs`, `.d.ts` files
