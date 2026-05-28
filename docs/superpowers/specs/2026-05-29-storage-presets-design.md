# Storage Presets Design

## Overview

Add preset `StorageLike` adapters for common storage targets (Cookie, WeChat Mini Program, Douyin Mini Program, Alipay Mini Program, uni-app, React Native, Node.js), enabling users to pass them directly into `createProxyStorage`.

## Architecture

### Approach: Generic Mini-Program Adapter + Platform Convenience Wrappers

WeChat, Douyin, and uni-app share identical storage API signatures. A shared `createMiniProgramStorage` / `createMiniProgramStorageAsync` eliminates duplication. Alipay has a different API signature and gets its own implementation. Cookie, React Native, and Node.js each have unique implementations.

## File Structure

```
src/presets/
  cookie.ts           → cookieStorage: SyncStorageLike
  mini-program.ts     → createMiniProgramStorage / createMiniProgramStorageAsync + types
  wechat.ts           → wechatStorage / wechatStorageAsync
  douyin.ts           → douyinStorage / douyinStorageAsync
  alipay.ts           → alipayStorage / alipayStorageAsync + types
  uni-app.ts          → uniStorage / uniStorageAsync
  react-native.ts     → createReactNativeStorage + types
  node.ts             → memoryStorage: SyncStorageLike
```

## Exports

### Sub-path Exports (package.json)

Each preset is a separate sub-path export for tree-shaking:

```json
{
  "exports": {
    ".": { "types": "./dist/stokado.d.ts", "import": "./dist/stokado.mjs", "require": "./dist/stokado.cjs" },
    "./presets/cookie": { "types": "./dist/presets/cookie.d.ts", "import": "./dist/presets/cookie.mjs", "require": "./dist/presets/cookie.cjs" },
    "./presets/wechat": { "types": "./dist/presets/wechat.d.ts", "import": "./dist/presets/wechat.mjs", "require": "./dist/presets/wechat.cjs" },
    "./presets/douyin": { "types": "./dist/presets/douyin.d.ts", "import": "./dist/presets/douyin.mjs", "require": "./dist/presets/douyin.cjs" },
    "./presets/alipay": { "types": "./dist/presets/alipay.d.ts", "import": "./dist/presets/alipay.mjs", "require": "./dist/presets/alipay.cjs" },
    "./presets/uni-app": { "types": "./dist/presets/uni-app.d.ts", "import": "./dist/presets/uni-app.mjs", "require": "./dist/presets/uni-app.cjs" },
    "./presets/react-native": { "types": "./dist/presets/react-native.d.ts", "import": "./dist/presets/react-native.mjs", "require": "./dist/presets/react-native.cjs" },
    "./presets/node": { "types": "./dist/presets/node.d.ts", "import": "./dist/presets/node.mjs", "require": "./dist/presets/node.cjs" }
  }
}
```

### Export Names

| Sub-path | Export Name | Type | Notes |
|----------|-------------|------|-------|
| `stokado/presets/cookie` | `cookieStorage` | `SyncStorageLike` | Based on `document.cookie` |
| `stokado/presets/wechat` | `wechatStorage` | `SyncStorageLike` | Based on `wx` global |
| `stokado/presets/wechat` | `wechatStorageAsync` | `AsyncStorageLike` | Based on `wx` global |
| `stokado/presets/douyin` | `douyinStorage` | `SyncStorageLike` | Based on `tt` global |
| `stokado/presets/douyin` | `douyinStorageAsync` | `AsyncStorageLike` | Based on `tt` global |
| `stokado/presets/alipay` | `alipayStorage` | `SyncStorageLike` | Based on `my` global |
| `stokado/presets/alipay` | `alipayStorageAsync` | `AsyncStorageLike` | Based on `my` global |
| `stokado/presets/uni-app` | `uniStorage` | `SyncStorageLike` | Based on `uni` global |
| `stokado/presets/uni-app` | `uniStorageAsync` | `AsyncStorageLike` | Based on `uni` global |
| `stokado/presets/react-native` | `createReactNativeStorage` | Factory function | Requires AsyncStorage injection |
| `stokado/presets/node` | `memoryStorage` | `SyncStorageLike` | In-memory Map-based |

The generic factory functions are also exported from their respective files for advanced use:
- `createMiniProgramStorage(api)` and `createMiniProgramStorageAsync(api)` from `stokado/presets/mini-program` (if we decide to expose this sub-path)

## Type Definitions

### Mini-Program API Types (mini-program.ts)

```ts
interface MiniProgramSyncAPI {
  getStorageSync(key: string): any
  setStorageSync(key: string, data: any): void
  removeStorageSync(key: string): void
  clearStorageSync(): void
  getStorageInfoSync(): { keys: string[]; currentSize: number; limitSize: number }
}

interface MiniProgramAsyncAPI {
  getStorage(options: { key: string }): Promise<{ data: any }>
  setStorage(options: { key: string; data: any }): Promise<void>
  removeStorage(options: { key: string }): Promise<void>
  clearStorage(): Promise<void>
  getStorageInfo(): Promise<{ keys: string[]; currentSize: number; limitSize: number }>
}
```

### Alipay API Types (alipay.ts)

```ts
interface AlipaySyncAPI {
  getStorageSync(options: { key: string }): { data: any }
  setStorageSync(options: { key: string; data: any }): void
  removeStorageSync(options: { key: string }): void
  clearStorageSync(): void
  getStorageInfoSync(): { keys: string[]; currentSize: number; limitSize: number }
}

interface AlipayAsyncAPI {
  getStorage(options: { key: string }): Promise<{ data: any }>
  setStorage(options: { key: string; data: any }): Promise<void>
  removeStorage(options: { key: string }): Promise<void>
  clearStorage(): Promise<void>
  getStorageInfo(): Promise<{ keys: string[]; currentSize: number; limitSize: number }>
}
```

### React Native Types (react-native.ts)

```ts
interface ReactNativeAsyncStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
  getAllKeys(): Promise<string[]>
}
```

## Implementation Details

### Cookie Adapter (cookie.ts)

Cookie API is string-based (`document.cookie`), requiring parsing:

- `getItem(key)`: Parse `document.cookie` with regex, `decodeURIComponent` on value
- `setItem(key, value)`: Set `document.cookie` with `encodeURIComponent`
- `removeItem(key)`: Set cookie with `expires=Thu, 01 Jan 1970 00:00:00 GMT`
- `clear()`: Iterate all cookie keys, remove each
- `key(index)`: Parse all keys, return key at index or `null`
- `length` (getter): Count of cookie entries

### Generic Mini-Program Adapter (mini-program.ts)

WeChat, Douyin, and uni-app share this implementation:

**Sync (`createMiniProgramStorage(api)`):**
- `getItem(key)`: `api.getStorageSync(key)` — convert empty string to `null`
- `setItem(key, value)`: `api.setStorageSync(key, value)`
- `removeItem(key)`: `api.removeStorageSync(key)`
- `clear()`: `api.clearStorageSync()`
- `key(index)`: `api.getStorageInfoSync().keys[index] ?? null`
- `length` (getter): `api.getStorageInfoSync().keys.length`

**Async (`createMiniProgramStorageAsync(api)`):**
- `getItem(key)`: `api.getStorage({ key })` → extract `.data`
- `setItem(key, value)`: `api.setStorage({ key, data: value })`
- `removeItem(key)`: `api.removeStorage({ key })`
- `clear()`: `api.clearStorage()`
- `key(index)`: `api.getStorageInfo().keys[index] ?? null`
- `length()`: `api.getStorageInfo().keys.length`

### Alipay Adapter (alipay.ts)

Alipay uses object parameters and different return formats:

**Sync (`alipayStorage`):**
- `getItem(key)`: `my.getStorageSync({ key }).data` — unwrap `{data}` object
- `setItem(key, value)`: `my.setStorageSync({ key, data: value })` — object params
- `removeItem(key)`: `my.removeStorageSync({ key })` — object params
- `clear()`: `my.clearStorageSync()`
- `key(index)`: `my.getStorageInfoSync().keys[index] ?? null`
- `length` (getter): `my.getStorageInfoSync().keys.length`

**Async (`alipayStorageAsync`):**
- `getItem(key)`: `my.getStorage({ key })` → extract `.data`
- `setItem(key, value)`: `my.setStorage({ key, data: value })`
- `removeItem(key)`: `my.removeStorage({ key })`
- `clear()`: `my.clearStorage()`
- `key(index)`: `my.getStorageInfo().keys[index] ?? null`
- `length()`: `my.getStorageInfo().keys.length`

### React Native Adapter (react-native.ts)

Factory function requiring AsyncStorage injection:

- `getItem(key)`: `asyncStorage.getItem(key)` — already returns `Promise<string | null>`
- `setItem(key, value)`: `asyncStorage.setItem(key, value)`
- `removeItem(key)`: `asyncStorage.removeItem(key)`
- `clear()`: `asyncStorage.clear()`
- `key(index)`: `asyncStorage.getAllKeys()[index] ?? null`
- `length()`: `asyncStorage.getAllKeys().length`

### Node.js Memory Storage (node.ts)

Simple Map-based in-memory storage:

- `getItem(key)`: `map.get(key) ?? null`
- `setItem(key, value)`: `map.set(key, value)`
- `removeItem(key)`: `map.delete(key)`
- `clear()`: `map.clear()`
- `key(index)`: `[...map.keys()][index] ?? null`
- `length` (getter): `map.size`

## Edge Cases

| Scenario | Handling |
|----------|----------|
| WeChat `getStorageSync` returns empty string for missing key | Convert to `null` to match `getItem` contract |
| Cookie values with special characters | `encodeURIComponent` / `decodeURIComponent` |
| Alipay `getStorageSync` returns `{data}` wrapper | Unwrap `.data` property |
| `key()` out-of-bounds access | Return `null` |
| `length` calls `getStorageInfoSync` on every access | Acceptable for mini-programs (small storage, low overhead) |

## Build Configuration

### Rollup Changes

Add preset entry points to `rollup.config.js`. Each preset generates `.mjs`, `.cjs`, `.d.ts` outputs independently.

### tsconfig Changes

Include `src/presets/**/*.ts` in the compilation.

## Usage Examples

```ts
// Cookie
import { createProxyStorage } from 'stokado'
import { cookieStorage } from 'stokado/presets/cookie'
const storage = createProxyStorage(cookieStorage)

// WeChat Mini Program (sync)
import { createProxyStorage } from 'stokado'
import { wechatStorage } from 'stokado/presets/wechat'
const storage = createProxyStorage(wechatStorage)

// WeChat Mini Program (async)
import { wechatStorageAsync } from 'stokado/presets/wechat'
const storage = createProxyStorage(wechatStorageAsync)

// React Native
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createReactNativeStorage } from 'stokado/presets/react-native'
const storage = createProxyStorage(createReactNativeStorage(AsyncStorage))

// Node.js
import { memoryStorage } from 'stokado/presets/node'
const storage = createProxyStorage(memoryStorage)
```
