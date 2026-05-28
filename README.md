```shell
         __                __  __                __
  ____  /\ \__     ___    /\ \/  \      __      /\ \     ___
 / ,__\ \ \ ,_\   / __`\  \ \    <    /'__`\    \_\ \   / __`\
/\__, `\ \ \ \/  /\ \_\ \  \ \  ^  \ /\ \_\.\_ /\ ,. \ /\ \_\ \
\/\____/  \ \ \_ \ \____/   \ \_\ \_\\ \__/.\_\\ \____\\ \____/
 \/___/    \ \__\ \/___/     \/_/\/_/ \/__/\/_/ \/___ / \/___/
            \/__/
```

**English | [中文](./README.zh.md) | [日本語](./README.ja.md)**

[v2 document](./v2.md)

> *Stokado*(/stəˈkɑːdoʊ/) is the [Esperanto](https://en.wikipedia.org/wiki/Esperanto)(an international auxiliary language) for *storage*, meaning that *Stokado* is also an auxiliary agent for *storage*.

`stokado` can proxy objects of any `storage`-like, providing getter/setter syntax sugars, serialization, subscription listening, expiration setting, one-time value retrieval.

The most feature-rich proxy wrapper for browser storage — serialization, reactivity, expiration, and one-time values in one library.

## Why stokado?

| Feature | stokado | store2 | local-storage-fallback | lz-string |
|---------|---------|--------|----------------------|-----------|
| Proxy syntax sugar | ✅ | ❌ | ❌ | ❌ |
| Type-safe serialization | ✅ | ❌ | ❌ | ❌ |
| Reactive subscribe | ✅ | ❌ | ❌ | ❌ |
| Expiration | ✅ | ✅ | ❌ | ❌ |
| Disposable values | ✅ | ❌ | ❌ | ❌ |
| Async storage support | ✅ | ❌ | ❌ | ❌ |
| Cross-tab sync | ✅ | ❌ | ❌ | ❌ |
| Quota alert | ✅ | ❌ | ❌ | ❌ |
| Zero dependencies | ✅ | ✅ | ✅ | ✅ |

## When to use stokado

- **Type preservation** — You need localStorage values to keep their JavaScript type (number, boolean, Date, RegExp, etc.) instead of everything becoming a string
- **Reactive storage** — You need to listen for storage changes within the same tab (native `storage` event only fires cross-tab)
- **Auto-expiration** — You need stored items to automatically expire and clean up (token management, cache strategies)
- **One-time values** — You need disposable values for cross-component or cross-page communication
- **Cross-tab sync** — You need real-time synchronization of storage changes across browser tabs
- **Async backends** — You need to work with async storage like localForage or IndexedDB wrappers with the same API
- **Quota alert** — You need to monitor storage usage and get notified when approaching storage limits, with the option to block writes that would exceed the quota

## Usage

### Install

```shell
npm install stokado
```

### Proxy

```js
import { createProxyStorage } from 'stokado'

const storage = createProxyStorage(localStorage)

storage.getItem('test')
```

#### createProxyStorage(storage[, options])

`createProxyStorage` takes two parameters: an object of `storage`-like and an optional `options`. The `options` object supports the following fields:

- `broadcast` — Whether to sync `storage` modifications with other pages. Default is `true` for `localStorage`, `false` for `sessionStorage`.
- `channel` — The channel name for cross-tab sync. By default, `localStorage` uses `'localStorage'` as the channel name.
- `quota` — Storage size limit in bytes. When set, stokado tracks the size of all data written through the proxy and triggers a callback when the limit is exceeded.
- `onQuotaExceeded` — Callback function triggered when storage usage exceeds the `quota` limit. Receives a `QuotaInfo` object with `{ current, limit, key, value }`. Return `false` to block the write, or any other value to allow it. Supports async callbacks.

### Features

#### 1. Syntax sugar

Operate `storage` directly through object-oriented approach

Of course, `localStorage` and `sessionStorage` are supported natively

```js
const storage = createProxyStorage(localStorage)

storage.test = 'hello stokado'

storage.test // 'hello stokado'

delete storage.test
```

The `storage` also have the same methods and properties: `key()`, `getItem()`, `setItem()`, `removeItem()`, `clear()` and `length`.

#### 2. Serializer

Keep the type of storage value unchanged

```js
// number
storage.test = 0
storage.test === 0

// boolean
storage.test = false
storage.test === false

// undefined
storage.test = undefined
storage.test === undefined

// null
storage.test = null
storage.test === null

// object
storage.test = { hello: 'world' }
storage.test.hello === 'stokado'

// array
storage.test = ['hello']
storage.test.push('stokado')
storage.test.length // 2

// Date
storage.test = new Date('2000-01-01T00:00:00.000Z')
storage.test.getTime() === 946684800000

// RegExp
storage.test = /d(b+)d/g
storage.test.test('cdbbdbsbz')

// function
storage.test = function () {
  return 'hello stokado!'
}
storage.test() === 'hello stokado!'
```

#### 3. Subscribe

Subscribe to value changes

```js
storage.on(key, callback)

storage.once(key, callback)

storage.off([[key], callback])
```

- `key`: the name of the item to subscribe to. Support `obj.a` for `Object` and `list[0]` for `Array`, and also `Array` length.
- `callback`: the function to call when the item is changed. Includes `newValue` and `oldValue`.

**Tips:** For `off`, if a `callback` exists, it removes the trigger of the specified callback; otherwise, it removes all callbacks bound to the `key`; if the `key` is empty, it removes all listening callbacks.

#### 4. Expired

Set expires for items

```js
storage.setExpires(key, expires)

storage.getExpires(key)

storage.removeExpires(key)
```

- `key`: the name of the item to set expires.
- `expires`: accept `string`、`number` and `Date`.

#### 5. Disposable

Get the value once, which can be used for communication through `storage`.

```js
storage.setDisposable(key)
```

- `key`：the name of the item to set disposable.

#### 6. Options

Get `expires` and `disposable` configuration information for the specified item

```js
storage.getOptions(key)
```

Set `expires` and `disposable` using `setItem`

```js
storage.setItem(key, value, { expires, disposable })
```

#### 7. Quota Alert

Monitor storage usage and get notified when approaching limits

```js
import { createProxyStorage, MB } from 'stokado'

const storage = createProxyStorage(localStorage, {
  quota: 5 * MB,
  onQuotaExceeded({ current, limit, key }) {
    console.warn(`Storage quota exceeded: ${current}/${limit} bytes, key: "${key}"`)
    return false
  }
})

storage.getUsage()

await storage.ready
```

- `quota`: Storage size limit in bytes. Use `KB` and `MB` constants for readability.
- `onQuotaExceeded`: Callback when the limit is exceeded. Receives `{ current, limit, key, value }`. Return `false` to block the write.
- `getUsage()`: Returns `{ current, limit }` — the current usage and the configured limit.
- `ready`: A `Promise` that resolves when the size tracker has finished scanning existing keys. For sync storages, it resolves immediately.

**Note:** The size calculation is based on the UTF-8 byte size of the encoded envelope (key + value) actually stored in the underlying storage. This closely approximates but may not exactly match the browser's internal storage accounting.

**Limitations:**
- Quota tracking covers data written through the stokado proxy and pre-existing keys scanned at initialization.
- Direct writes to the underlying storage from the same tab (bypassing stokado) are not tracked and may cause actual usage to exceed the quota without triggering an alert.
- Cross-tab writes are tracked through the `storage` event when broadcast is enabled, but there may be a brief delay.

## AI Coding Rules

If you're using AI coding tools (Cursor, Copilot, Windsurf, etc.), copy the rules from [`ai-rules/.cursorrules`](./ai-rules/.cursorrules) to your project root as `.cursorrules` to help your AI assistant follow stokado best practices.

## Work with localForage

`localForage` provides the same API as `localStorage`, it can be used in conjunction with `stokado`.

```js
import localForage from 'localforage'
import { createProxyStorage } from 'stokado'

const local = createProxyStorage(localForage, { channel: 'localForage' })
```

However, `localForage` uses an async API, it needs to be called using `Promise`.

```js
await (local.test = 'hello localForage')

// or

await local.setItem('test', 'hello localForage')
```

#### Multiple instances

You can create multiple instances of `localForage` that point to different stores using `createInstance`.

```js
const store = localforage.createInstance({
  name: 'nameHere'
})
const proxyStore = createProxyStorage(store, { channel: 'store' })

const otherStore = localforage.createInstance({
  name: 'otherName'
})
const proxyOtherStore = createProxyStorage(otherStore, { channel: 'otherStore' })
```

## Keywords

stokado is a localStorage wrapper, browser storage proxy, web storage library, and storage utility for JavaScript. It provides localStorage serialization, storage reactivity, storage subscription, storage expiration, storage quota alert, cross-tab storage sync, and async storage support. Alternatives to store2, lscache, local-storage-fallback. Works with localStorage, sessionStorage, localForage, and any storage-like object.
