import PLoop from 'p-run-loop'
import ThenRef from 'then-ref'
import { getExpires, removeExpires, setExpires } from '@/extends/expires'
import { clearProxyStorage, deleteProxyStorageProperty, getProxyStorageProperty, getRaw, setProxyStorage, setProxyStorageProperty, storageNameMap } from '@/shared'
import { ExtendMethods, StorageMethods, SymbolStorageMethods, hasOwn, isArray, isFunction, isLocalStorage, isObject, isPromise, isStorage, isString } from '@/utils'
import { emit, off, on, once } from '@/extends/watch'
import type { StorageLike, StorageObject, StorageOptions } from '@/types'
import { checkDisposable, setDisposable } from '@/extends/disposable'
import { getOptions } from '@/extends/options'
import { listenMessage } from '@/proxy/broadcast'

const nativeMethods: Record<string, Function> = {
  clear,
  getItem,
  setItem,
  removeItem,
}
const extendMethods: Record<string, Function> = {
  getExpires,
  getOptions,
  off,
  on,
  once,
  removeExpires,
  setDisposable,
  setExpires,
}

function clear(storage: StorageLike) {
  return function () {
    clearProxyStorage(storage)
  }
}

function getItem(storage: StorageLike) {
  return function (key: string) {
    return getProxyStorageProperty(storage, key).then((res: StorageObject | string | null) => {
      const returnData = checkDisposable(res, () => {
        deleteProxyStorageProperty(storage, key)
      })
      return isObject(returnData) ? returnData.value : (returnData || undefined)
    }).value
  }
}

function removeItem(storage: StorageLike) {
  return function (key: string) {
    return getProxyStorageProperty(storage, key).then((res: StorageObject | string | null) => {
      return deleteProxyStorageProperty(storage, key).then(() => {
        const oldValue = isObject(res) ? res.value : (res || undefined)
        emit(storage, key, undefined, getRaw(oldValue), key)
        return true
      })
    }).value
  }
}

function setItem(storage: StorageLike) {
  return function (property: string, value: any, options?: StorageOptions) {
    return getProxyStorageProperty(storage, property).then((res: StorageObject | string | null) => {
      const oldValue = isObject(res) ? res.value : (res || undefined)
      const oldOptions = isObject(res) ? res.options : {}

      return setProxyStorageProperty(storage, property, value, Object.assign({}, oldOptions, options)).then(() => {
        emit(storage, property, value, getRaw(oldValue), property)
        if (isArray(value) && isArray(oldValue))
          emit(storage, `${property}.length`, value.length, oldValue.length)

        return value
      })
    }).value
  }
}

function get(
  storage: StorageLike,
  property: string,
) {
  if (hasOwn(nativeMethods, property))
    return nativeMethods[property](storage)

  if (ExtendMethods.includes(property)) {
    const proxyKey = SymbolStorageMethods.get(property)!
    return function (...args: any[]) {
      return storage[proxyKey](storage, ...args)
    }
  }

  const data = storage[property]

  if (!isString(data) && data !== undefined)
    return isFunction(data) ? data.bind(storage) : data

  return getItem(storage)(property)
}

function set(
  storage: StorageLike,
  property: string,
  value: any,
) {
  return setItem(storage)(property, value)
}

function deleteProperty(
  storage: StorageLike,
  property: string,
) {
  return removeItem(storage)(property)
}

export function createProxyStorage(storage: StorageLike, name?: string) {
  if (!isStorage(storage))
    throw new Error('The parameter should be StorageLike object')

  const loop = new PLoop()
  const isPromiseFlag = isPromise(storage.getItem('stokado'))
  for (const key of StorageMethods) {
    const proxyKey = SymbolStorageMethods.get(key)!
    storage[proxyKey] = ThenRef(isPromiseFlag ? loop.add(storage[key]) : storage[key])
  }
  for (const key of ExtendMethods) {
    const proxyKey = SymbolStorageMethods.get(key)!
    // storage[proxyKey] = isPromiseFlag ? loop.add(extendMethods[key]) : extendMethods[key]
    storage[proxyKey] = extendMethods[key]
  }

  const proxy = new Proxy(storage, {
    get,
    set,
    deleteProperty,
  })

  setProxyStorage(storage, {})

  if (!name)
    console.warn('If you are using IndexedDB or WebSQL, `name` is required.')

  if (name || isLocalStorage(storage)) {
    storageNameMap.set(storage, name || 'localStorage')
    listenMessage(storage)
  }

  return proxy
}
