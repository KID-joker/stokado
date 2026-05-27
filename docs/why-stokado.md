# Why Stokado?

## The Problem with Raw localStorage

Browser `localStorage` and `sessionStorage` have six fundamental limitations:

1. **String-only storage** — All values are converted to strings. `storage.setItem('count', 0)` stores `"0"`, not `0`. `storage.setItem('active', false)` stores `"false"`, not `false`.

2. **No type preservation** — After reading back, you must manually parse: `Number(localStorage.getItem('count'))`, `JSON.parse(localStorage.getItem('user'))`. This is error-prone and verbose.

3. **No reactivity** — The native `storage` event only fires in *other* tabs, not the current one. There's no built-in way to react to storage changes within the same page.

4. **No expiration** — localStorage items persist forever. Managing TTL (time-to-live) requires manual timestamp tracking and cleanup logic.

5. **No cross-tab sync** — While the `storage` event exists, it's one-directional and doesn't provide a clean API for real-time synchronization.

6. **Verbose API** — `localStorage.setItem('key', JSON.stringify(value))` / `JSON.parse(localStorage.getItem('key'))` is repetitive and easy to get wrong.

## How Stokado Solves This

### 1. Type-Safe Serialization

```js
import { createProxyStorage } from 'stokado'
const storage = createProxyStorage(localStorage)

storage.count = 0
storage.count === 0 // true — not "0"

storage.active = false
storage.active === false // true — not "false"

storage.user = { name: 'Alice' }
storage.user.name // 'Alice' — no JSON.parse needed

storage.createdAt = new Date('2024-01-01')
storage.createdAt.getFullYear() // 2024 — Date preserved

storage.pattern = /hello/gi
storage.pattern.test('HELLO') // true — RegExp preserved
```

Supported types: String, Number, BigInt, Boolean, Null, Undefined, Object, Array, Set, Map, Date, RegExp, URL, Function.

### 2. Proxy Syntax Sugar

```js
// Instead of:
localStorage.setItem('user', JSON.stringify({ name: 'Alice' }))
const user = JSON.parse(localStorage.getItem('user'))

// With stokado:
storage.user = { name: 'Alice' }
storage.user.name // 'Alice'
storage.user.name = 'Bob' // direct mutation works
```

### 3. Reactive Subscriptions

```js
// Native storage event only works cross-tab — useless for same-tab reactivity
// stokado's subscribe works everywhere:

storage.on('token', (newVal, oldVal) => {
  updateAuthUI(newVal)
})

storage.on('user.name', (newVal) => {
  updateHeader(newVal)
})

storage.on('items.length', (newLen) => {
  updatePagination(newLen)
})
```

### 4. Automatic Expiration

```js
// Instead of manual timestamp tracking:
// const item = JSON.parse(localStorage.getItem('token'))
// if (item && item.expiry > Date.now()) { ... }

// With stokado:
storage.setItem('token', 'abc123', { expires: Date.now() + 3600000 })
// or
storage.token = 'abc123'
storage.setExpires('token', '1h')

// After 1 hour, storage.token returns undefined and the item is removed
```

### 5. Cross-Tab Synchronization

```js
// Tab A
storage.token = 'new-token'

// Tab B — automatically updated via BroadcastChannel
storage.on('token', (newVal) => {
  console.log('Updated:', newVal) // 'new-token'
})
```

### 6. Disposable Values

```js
storage.setItem('flash-message', 'Welcome!', { disposable: true })
storage['flash-message'] // 'Welcome!' (first read)
storage['flash-message'] // undefined (auto-removed)
```

## Comparison with Alternatives

### stokado vs store2

store2 is a popular localStorage wrapper, but it lacks several key features:

| Feature | stokado | store2 |
|---------|---------|--------|
| Proxy syntax sugar | ✅ Native getter/setter | ❌ Method-based only |
| Type-safe serialization | ✅ 14 types | ❌ JSON only |
| Deep object mutation | ✅ `storage.user.name = 'Bob'` | ❌ Must set entire object |
| Reactive subscribe | ✅ `on`/`once`/`off` | ❌ Not supported |
| Expiration | ✅ Built-in | ✅ Via `set` with TTL |
| Disposable values | ✅ Built-in | ❌ Not supported |
| Async storage | ✅ localForage etc. | ❌ Sync only |
| Cross-tab sync | ✅ BroadcastChannel | ❌ Not supported |
| Zero dependencies | ✅ | ✅ |

### stokado vs local-storage-fallback

local-storage-fallback is a minimal fallback for environments without localStorage. It doesn't provide any of stokado's features — it's solving a different problem.

### stokado vs lz-string

lz-string provides compression for localStorage strings. It doesn't provide type preservation, reactivity, expiration, or any of stokado's features. They can be used together if compression is needed.

## Migration Cost

Migrating from raw localStorage to stokado is nearly zero-cost:

```js
// Before
localStorage.setItem('key', JSON.stringify(value))
const value = JSON.parse(localStorage.getItem('key'))

// After — just wrap with createProxyStorage
const storage = createProxyStorage(localStorage)
storage.key = value
const val = storage.key
```

Existing data in localStorage is compatible — stokado can read raw strings written by `localStorage.setItem`. New writes will use stokado's serialization format.

## Performance

- **Bundle size:** ~3KB minified + gzipped
- **Zero dependencies**
- **Lazy deserialization:** Values are only decoded when accessed
- **In-memory cache:** Frequently accessed values don't hit storage
- **Batched writes:** Operations are scheduled to minimize storage access
