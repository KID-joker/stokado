```shell
         __                __  __                __
  ____  /\ \__     ___    /\ \/  \      __      /\ \     ___   
 / ,__\ \ \ ,_\   / __`\  \ \    <    /'__`\    \_\ \   / __`\ 
/\__, `\ \ \ \/  /\ \_\ \  \ \  ^  \ /\ \_\.\_ /\ ,. \ /\ \_\ \
\/\____/  \ \ \_ \ \____/   \ \_\ \_\\ \__/.\_\\ \____\\ \____/
 \/___/    \ \__\ \/___/     \/_/\/_/ \/__/\/_/ \/___ / \/___/ 
            \/__/
```

**English | [中文](./README.zh.md)**

A more convenient way to use storage through proxy.

try it on [codesandbox](https://codesandbox.io/s/proxy-web-storage-demo-3w6uex).

## Install

```shell
npm i stokado
```

## Features

### Base

Keep the type of storage value unchanged and change array and object directly.

```js
import { local, session } from 'stokado'

local.test = 'hello stokado' // works
delete local.test // works

// number
local.test = 0
local.test === 0 // true

// boolean
local.test = false
local.test === false // true

// undefined
local.test = undefined
local.test === undefined // true

// null
local.test = null
local.test === null // true

// object
local.test = { hello: 'world' }
local.test.hello = 'stokado' // works

// array
local.test = ['hello']
local.test.push('stokado') // works
local.test.length // 2

// Date
local.test = new Date('2000-01-01T00:00:00.000Z')
local.test.getTime() === 946684800000 // true

// RegExp
local.test = /d(b+)d/g
local.test.test('cdbbdbsbz') // true

// function
local.test = function () {
  return 'hello stokado!'
}
local.test() === 'hello stokado!' // true
```

`test` is the key in localStorage. The value is also saved to localStorage.
The `local`, `session` also have the same methods and properties: `key()`, `getItem()`, `setItem()`, `removeItem()`, `clear()` and `length`.

### Subscribe

listen to the changes.

```js
import { local } from 'stokado'

local.on('test', (newVal, oldVal) => {
  console.log('test', newVal, oldVal)
})
local.on('test.a', (newVal, oldVal) => {
  console.log('test.a', newVal, oldVal)
})

local.test = {}
// test {} undefined

local.test.a = 1
// test.a 1 undefined
```

#### on

Subscribe to an item.

- `key`: the name of the item to subscribe to. Support `obj.a` for `Object` and `list[0]` for `Array`, and also `Array` length.
- `callback`: the function to call when the item is changed. Includes `newValue` and `oldValue`.

#### once

Subscribe to an item only once.

- `key`: the name of the item to subscribe to. Support `obj.a` for `Object` and `list[0]` for `Array`.
- `callback`: the function to call when the item is changed. Includes `newValue` and `oldValue`.

#### off

Unsubscribe from an item or all items.

- `key(optional)`: the name of the item to unsubscribe from. If no key is provided, it unsubscribes you from all items.
- `callback(optional)`: the function used when binding to the item. If no callback is provided, it unsubscribes you from all functions binding to the item.

### Expired

set expires for items.

```js
import { local } from 'stokado'

local.test = 'hello stokado'
local.setExpires('test', Date.now() + 10000)

// within 10's
local.test // 'hello stokado'

// after 10's
local.test // undefined
```

The expires is saved to localStorage.
So no matter how you reload it within 10's, the value still exists.
But after 10's, it has been removed.

#### setExpires

set expires for an item.

- `key`: the name of the item to set expires.
- `expires`: accept `string`、`number` and `Date`.

#### getExpires

return the expires(`Date`) of the item.

- `key`: the name of the item that has set expires.

#### removeExpires

cancel the expires of the item.

- `key`: the name of the item that has set expires.
