# proxy-web-storage

**[English](./README.md) | 中文**

通过`proxy`更方便快捷地使用`storage`。

在[codesandbox](https://codesandbox.io/s/proxy-web-storage-demo-3w6uex)试一试。

## Install

```shell
npm i proxy-web-storage
```

## Features

### Base

保持`storage`值的类型不变并且可以直接操作数组和对象。

```js
import { local, session } from 'proxy-web-storage'

local.test = 'hello proxy-web-storage' // works
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
local.test.hello = 'proxy-web-storage' // works

// array
local.test = ['hello']
local.test.push('proxy-web-storage') // works
local.test.length // 2

// Date
local.test = new Date('2000-01-01T00:00:00.000Z')
local.test.getTime() === 946684800000 // true

// RegExp
local.test = /d(b+)d/g
local.test.test('cdbbdbsbz') // true

// function
local.test = function () {
  return 'hello proxy-web-storage!'
}
local.test() === 'hello proxy-web-storage!' // true
```

`test`和对应的`value`是实际保存到`localStorage`的。同时，`local`和`session`也支持`Web Storage`的方法和属性：`key()`，`getItem()`，`setItem()`，`removeItem()`，`clear()` 和 `length`。

### Subscribe

监听值的变化。

```js
import { local } from 'proxy-web-storage'

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

监听指定项。

参数：

- `key`：监听指定项的名字。支持对象的二级监听，例如：`obj.a` 对于 `Object` 和 `list[0]` 对于 `Array`，还支持数组长度的监听。
- `callback`：指定项的值发生变化时，触发的回调函数。参数包括`newValue` 和 `oldValue`。

#### once

只监听指定项一次。

- `key`：监听指定项的名字。支持对象的二级监听，例如：`obj.a` 对于 `Object` 和 `list[0]` 对于 `Array`，还支持数组长度的监听。
- `callback`：指定项的值发生变化时，触发的回调函数。参数包括`newValue` 和 `oldValue`。

#### off

取消监听指定项或者移除所有监听。

- `key（可选）`：期望移除监听的指定项。如果为空，则移除所有监听。
- `callback（可选）`：移除指定项的某一回调函数。如果为空，则移除指定项绑定的所有监听事件。

### Expired

为指定项设置过期时间。

```js
import { local } from 'proxy-web-storage'

local.test = 'hello proxy-web-storage'
local.setExpires('test', Date.now() + 10000)

// within 10's
local.test // 'hello proxy-web-storage'

// after 10's
local.test // undefined
```

过期时间也会保存到`Web Storage`中，并不会刷新页面导致过期失效。
所以在10秒内无论你怎么刷新，值还是会存在。
但是在10秒以后，指定项就被移除了。

#### setExpires

为指定项设置过期时间。

- `key`：设置过期的指定项名字。
- `expires`：过期时间。接受`string`、`number` 和 `Date`类型。

#### getExpires

获取指定的过期时间，返回类型为`Date`。

- `key`: 设置了过期时间的指定项名字。

#### removeExpires

取消指定项的过期设置。

- `key`: 设置了过期时间的指定项名字。
