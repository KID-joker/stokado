```shell
         __                __  __                __
  ____  /\ \__     ___    /\ \/  \      __      /\ \     ___   
 / ,__\ \ \ ,_\   / __`\  \ \    <    /'__`\    \_\ \   / __`\ 
/\__, `\ \ \ \/  /\ \_\ \  \ \  ^  \ /\ \_\.\_ /\ ,. \ /\ \_\ \
\/\____/  \ \ \_ \ \____/   \ \_\ \_\\ \__/.\_\\ \____\\ \____/
 \/___/    \ \__\ \/___/     \/_/\/_/ \/__/\/_/ \/___ / \/___/ 
            \/__/
```

**[English](./README.md) | 中文 | [日本語](./README.ja.md)**

[v2 文档](./v2.zh.md)

> *stokado*(/stəˈkɑːdoʊ/) 是 *storage* 的[世界语](https://zh.wikipedia.org/wiki/%E4%B8%96%E7%95%8C%E8%AF%AD)(一种国际辅助语言)，喻意为 *stokado* 也是 *storage* 的辅助代理。

`stokado` 可以代理任何类 `storage` 的对象，实现简洁的 `getter`，`setter` 等语法糖，序列化，监听订阅，设置过期，一次性取值等功能。

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

`createProxyStorage` 接收两个参数：类 `storage` 对象和可选的 `name`。`name` 用于同步其他页面的 `storage` 修改。`localStorage` 默认存在同名的 `name`，`sessionStorage` 则没有，其他对象需自行传入。

### Features

#### 1. Syntax sugar

通过对象方式直接操作 `storage`

当然，`localStorage` 和 `sessionStorage` 本身也是支持的

```js
const storage = createProxyStorage(localStorage)

storage.test = 'hello stokado'

storage.test // 'hello stokado'

delete storage.test
```

同时也支持 `storage` 的原生方法和属性：`key()`，`getItem()`，`setItem()`，`removeItem()`，`clear()` 和 `length`。

#### 2. Serializer

保持值类型不变

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

监听储值的变化

```js
storage.on(key, callback)

storage.once(key, callback)

storage.off([[key], callback])
```

- `key`：监听指定项的名字。支持对象的二级监听，例如：`obj.a` 对于 `Object` 和 `list[0]` 对于 `Array`，还支持数组长度的监听。
- `callback`：指定项的值发生变化时，触发的回调函数。参数包括`newValue` 和 `oldValue`。

**Tips:** 对于 `off`，如果 `callback` 存在，则移除指定回调的触发；否则，移除对于 `key` 绑定的所有回调；如果 `key` 为空，移除所有监听回调。

#### 4. Expired

为指定项设置过期时间

```js
storage.setExpires(key, expires)

storage.getExpires(key)

storage.removeExpires(key)
```

- `key`：设置过期的指定项名字。
- `expires`：过期时间。接受`string`、`number` 和 `Date`类型。

#### 5. Disposable

一次性取值，可用于借助 `storage` 进行通信

```js
storage.setDisposable(key)
```

- `key`：设置一次性的指定项名字。

#### 6. Options

获取指定项的过期、一次性等配置信息

```js
storage.getOptions(key)
```

通过 `setItem` 设置过期及一次性

```js
storage.setItem(key, value, { expires, disposable })
```

## Work with localForage

因为 `localForage` 提供了跟 `localStorage` 一样的 API，它是类 `storage` 对象，可以跟 `stokado` 配合使用。

```js
import { createProxyStorage } from 'stokado'
import localForage from 'localforage'

const local = createProxyStorage(localForage, 'localForage')
```

但是因为 `localForage` 采用异步的 API，所以需要使用 `Promise` 来调用它。

```js
await (local.test = 'hello localForage')

// or

await local.setItem('test', 'hello localForage')
```

#### Multiple instances

通过 `createInstance` 可以创建多个 `localForage` 实例，也是类 `storage` 对象。

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
