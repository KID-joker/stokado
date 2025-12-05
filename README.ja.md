```shell
         __                __  __                __
  ____  /\ \__     ___    /\ \/  \      __      /\ \     ___
 / ,__\ \ \ ,_\   / __`\  \ \    <    /'__`\    \_\ \   / __`\
/\__, `\ \ \ \/  /\ \_\ \  \ \  ^  \ /\ \_\.\_ /\ ,. \ /\ \_\ \
\/\____/  \ \ \_ \ \____/   \ \_\ \_\\ \__/.\_\\ \____\\ \____/
 \/___/    \ \__\ \/___/     \/_/\/_/ \/__/\/_/ \/___ / \/___/
            \/__/
```

**[English](./README.md) | [中文](./README.zh.md) | 日本語**

[v2 ドキュメント](./v2.md)

> *Stokado*(/stəˈkɑːdoʊ/) は *storage* の[エスペラント語](https://ja.wikipedia.org/wiki/%E3%82%A8%E3%82%B9%E3%83%9A%E3%83%A9%E3%83%B3%E3%83%88)(国際補助語)であり、*Stokado* は *storage* の補助エージェントでもあります。

`stokado` は、任意の `storage` ライクなオブジェクトをプロキシし、ゲッター/セッターのシンタックスシュガー、シリアライゼーション、サブスクリプションリスニング、期限設定、一度だけの値の取得を提供します。

## 使用方法

### インストール

```shell
npm install stokado
```

### プロキシ

```js
import { createProxyStorage } from 'stokado'

const storage = createProxyStorage(localStorage)

storage.getItem('test')
```

#### createProxyStorage(storage[, name])

`createProxyStorage` は2つのパラメータを取ります: `storage` ライクなオブジェクトとオプションの `name`。`name` は他のページと `storage` の変更を同期するために使用されます。デフォルトでは、`localStorage` は同じ `name` を持ちますが、`sessionStorage` は持ちません。他のオブジェクトの場合は手動で渡す必要があります。

### 機能

#### 1. シンタックスシュガー

オブジェクト指向のアプローチで直接 `storage` を操作します

もちろん、`localStorage` と `sessionStorage` はネイティブにサポートされています

```js
const storage = createProxyStorage(localStorage)

storage.test = 'hello stokado'

storage.test // 'hello stokado'

delete storage.test
```

`storage` には同じメソッドとプロパティもあります: `key()`, `getItem()`, `setItem()`, `removeItem()`, `clear()`, `length`。

#### 2. シリアライザー

ストレージ値の型を変更せずに保持します

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

#### 3. サブスクライブ

値の変更をサブスクライブします

```js
storage.on(key, callback)

storage.once(key, callback)

storage.off([[key], callback])
```

- `key`: サブスクライブするアイテムの名前。`Object` の `obj.a` や `Array` の `list[0]`、および `Array` の長さをサポートします。
- `callback`: アイテムが変更されたときに呼び出される関数。`newValue` と `oldValue` を含みます。

**ヒント:** `off` の場合、`callback` が存在する場合は指定されたコールバックのトリガーを削除します。存在しない場合は、`key` にバインドされたすべてのコールバックを削除します。`key` が空の場合は、すべてのリスニングコールバックを削除します。

#### 4. 期限

アイテムの期限を設定します

```js
storage.setExpires(key, expires)

storage.getExpires(key)

storage.removeExpires(key)
```

- `key`: 期限を設定するアイテムの名前。
- `expires`: `string`、`number`、`Date` を受け入れます。

#### 5. 一度だけ

一度だけ値を取得します。これは `storage` を介して通信するために使用できます。

```js
storage.setDisposable(key)
```

- `key`：一度だけの値を設定するアイテムの名前。

#### 6. オプション

指定されたアイテムの `expires` と `disposable` の設定情報を取得します

```js
storage.getOptions(key)
```

`setItem` を使用して `expires` と `disposable` を設定します

```js
storage.setItem(key, value, { expires, disposable })
```

## localForage と一緒に使う

`localForage` は `localStorage` と同じ API を提供しているため、`stokado` と一緒に使用できます。

```js
import localForage from 'localforage'
import { createProxyStorage } from 'stokado'

const local = createProxyStorage(localForage, 'localForage')
```

ただし、`localForage` は非同期 API を使用しているため、`Promise` を使用して呼び出す必要があります。

```js
await (local.test = 'hello localForage')

// または

await local.setItem('test', 'hello localForage')
```

#### 複数のインスタンス

`createInstance` を使用して、異なるストアを指す `localForage` の複数のインスタンスを作成できます。

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
