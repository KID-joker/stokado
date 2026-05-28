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

最も機能豊富なブラウザストレージプロキシラッパー — シリアライゼーション、リアクティビティ、有効期限設定、一度だけの値を1つのライブラリで。

## なぜ stokado？

| 機能 | stokado | store2 | local-storage-fallback | lz-string |
|------|---------|--------|----------------------|-----------|
| Proxy シンタックスシュガー | ✅ | ❌ | ❌ | ❌ |
| 型安全なシリアライゼーション | ✅ | ❌ | ❌ | ❌ |
| リアクティブサブスクライブ | ✅ | ❌ | ❌ | ❌ |
| 有効期限設定 | ✅ | ✅ | ❌ | ❌ |
| 一度だけの値 | ✅ | ❌ | ❌ | ❌ |
| 非同期ストレージサポート | ✅ | ❌ | ❌ | ❌ |
| クロスタブ同期 | ✅ | ❌ | ❌ | ❌ |
| クォータアラート | ✅ | ❌ | ❌ | ❌ |
| ゼロ依存 | ✅ | ✅ | ✅ | ✅ |

## stokado を使うべきケース

- **型保持** — localStorage の値が JavaScript の型（number、boolean、Date、RegExp など）を文字列ではなくそのまま保持したい場合
- **リアクティブストレージ** — 同じタブ内でストレージの変更を監視したい場合（ネイティブの `storage` イベントはクロスタブのみ）
- **自動有効期限** — 保存されたアイテムを自動的に期限切れにしてクリーンアップしたい場合（トークン管理、キャッシュ戦略）
- **一度だけの値** — コンポーネント間やページ間の通信に使い捨ての値が必要な場合
- **クロスタブ同期** — ブラウザタブ間でストレージの変更をリアルタイムで同期したい場合
- **非同期バックエンド** — localForage や IndexedDB ラッパーなどの非同期ストレージを同じ API で使用したい場合
- **クォータアラート** — ストレージの使用量を監視し、制限に近づいたときに通知を受け取りたい場合。クォータを超える書き込みをブロックすることも可能

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

#### createProxyStorage(storage[, options])

`createProxyStorage` は2つのパラメータを取ります: `storage` ライクなオブジェクトとオプションの `options`。`options` オブジェクトは以下のフィールドをサポートします：

- `broadcast` — 他のページとの `storage` 変更を同期するかどうか。`localStorage` のデフォルトは `true`、`sessionStorage` のデフォルトは `false`。
- `channel` — クロスタブ同期のチャンネル名。`localStorage` はデフォルトで `'localStorage'` をチャンネル名として使用します。
- `quota` — ストレージサイズの制限（バイト単位）。設定すると、stokado はプロキシを通じて書き込まれたすべてのデータのサイズを追跡し、制限を超えたときにコールバックをトリガーします。
- `onQuotaExceeded` — ストレージ使用量が `quota` 制限を超えたときにトリガーされるコールバック関数。`{ current, limit, key, value }` を含む `QuotaInfo` オブジェクトを受け取ります。`false` を返すと書き込みをブロックし、その他の値は書き込みを許可します。非同期コールバックをサポートします。

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

#### 7. クォータアラート

ストレージの使用量を監視し、制限に近づいたときに通知を受け取ります

```js
import { createProxyStorage, MB } from 'stokado'

const storage = createProxyStorage(localStorage, {
  quota: 5 * MB,
  onQuotaExceeded({ current, limit, key }) {
    console.warn(`ストレージクォータ超過: ${current}/${limit} バイト、key: "${key}"`)
    return false // 書き込みをブロック
  }
})

// 現在の使用量を確認
storage.getUsage() // { current: 1234, limit: 5242880 }

// 初期化の完了を待機（localForage などの非同期ストレージで必要）
await storage.ready
```

- `quota`：ストレージサイズの制限（バイト単位）。読みやすくするために `KB` と `MB` 定数を使用できます。
- `onQuotaExceeded`：制限を超えたときのコールバック。`{ current, limit, key, value }` を受け取ります。`false` を返すと書き込みをブロックします。
- `getUsage()`：`{ current, limit }` を返します — 現在の使用量と設定された制限。
- `ready`：サイズトラッカーが既存のキーのスキャンを完了したときに解決される `Promise`。同期ストレージでは即座に解決されます。

**注意：** サイズ計算は、基盤となるストレージに実際に保存されているエンコードされたエンベロープ（key + value）の UTF-8 バイトサイズに基づいています。これはブラウザの内部ストレージ計算に近いですが、完全に一致するとは限りません。

**制限：**
- クォータ追跡は、stokado プロキシを通じて書き込まれたデータと、初期化時にスキャンされた既存のキーをカバーします。
- 同じタブで stokado をバイパスして基盤となるストレージに直接書き込んだ場合、追跡されず、実際の使用量がクォータを超えてもアラートがトリガーされない場合があります。
- クロスタブの書き込みは、ブロードキャストが有効な場合に `storage` イベントを通じて追跡されますが、わずかな遅延が発生する場合があります。

## AI コーディングルール

AI コーディングツール（Cursor、Copilot、Windsurf など）を使用している場合、[`ai-rules/.cursorrules`](./ai-rules/.cursorrules) のルールをプロジェクトルートの `.cursorrules` としてコピーすると、AI アシスタントが stokado のベストプラクティスに従います。

## localForage と一緒に使う

`localForage` は `localStorage` と同じ API を提供しているため、`stokado` と一緒に使用できます。

```js
import localForage from 'localforage'
import { createProxyStorage } from 'stokado'

const local = createProxyStorage(localForage, { channel: 'localForage' })
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
const proxyStore = createProxyStorage(store, { channel: 'store' })

const otherStore = localforage.createInstance({
  name: 'otherName'
})
const proxyOtherStore = createProxyStorage(otherStore, { channel: 'otherStore' })
```

## キーワード

stokado は localStorage ラッパー、ブラウザストレージプロキシ、Web ストレージライブラリです。localStorage シリアライゼーション、ストレージリアクティビティ、ストレージサブスクリプション、ストレージ有効期限、クロスタブストレージ同期、非同期ストレージサポート、ストレージクォータアラートを提供します。store2、lscache、local-storage-fallback の代替。localStorage、sessionStorage、localForage、および任意の storage ライクオブジェクトで動作します。
