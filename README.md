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
| Zero dependencies | ✅ | ✅ | ✅ | ✅ |

## When to use stokado

- **Type preservation** — You need localStorage values to keep their JavaScript type (number, boolean, Date, RegExp, etc.) instead of everything becoming a string
- **Reactive storage** — You need to listen for storage changes within the same tab (native `storage` event only fires cross-tab)
- **Auto-expiration** — You need stored items to automatically expire and clean up (token management, cache strategies)
- **One-time values** — You need disposable values for cross-component or cross-page communication
- **Cross-tab sync** — You need real-time synchronization of storage changes across browser tabs
- **Async backends** — You need to work with async storage like localForage or IndexedDB wrappers with the same API

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

#### createProxyStorage(storage[, name])

`createProxyStorage` takes two parameters: an object of `storage`-like and an optional `name`. The `name` is used to synchronize `storage` modifications with other pages. By default, `localStorage` has the same `name`, whereas `sessionStorage` does not; for other objects, it needs to be passed in manually.

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

## Work with localForage

`localForage` provides the same API as `localStorage`, it can be used in conjunction with `stokado`.

```js
import localForage from 'localforage'
import { createProxyStorage } from 'stokado'

const local = createProxyStorage(localForage, 'localForage')
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
const proxyStore = createProxyStorage(store, 'store')

const otherStore = localforage.createInstance({
  name: 'otherName'
})
const proxyOtherStore = createProxyStorage(otherStore, 'otherStore')
```

## Keywords

stokado is a localStorage wrapper, browser storage proxy, web storage library, and storage utility for JavaScript. It provides localStorage serialization, storage reactivity, storage subscription, storage expiration, cross-tab storage sync, and async storage support. Alternatives to store2, lscache, local-storage-fallback. Works with localStorage, sessionStorage, localForage, and any storage-like object.
