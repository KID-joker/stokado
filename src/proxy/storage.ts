import { getExpires, removeExpires, setExpires } from '@/extends/expires'
import { clearProxyStorage, deleteProxyStorageProperty, getProxyStorageProperty, getRaw, setProxyStorage, storageNameMap } from '@/shared'
import { hasOwn, isArray, isFunction, isLocalStorage, isObject, isStorage, isString, pThen } from '@/utils'
import { emit, off, on, once } from '@/extends/watch'
import type { StorageLike, StorageObject, StorageOptions } from '@/types'
import { encode } from '@/proxy/transform'
import { checkDisposable, setDisposable } from '@/extends/disposable'
import { getOptions } from '@/extends/options'
import { listenMessage } from '@/proxy/broadcast'

function clear(storage: Record<string, any>) {
  return function () {
    clearProxyStorage(storage)
  }
}

function getItem(storage: Record<string, any>) {
  return function (key: string) {
    return pThen(() => getProxyStorageProperty(storage, key), (res: StorageObject | string | null) => {
      const returnData = checkDisposable({ data: res, storage, property: key })
      return isObject(returnData) ? returnData.value : returnData
    })
  }
}

function removeItem(storage: Record<string, any>) {
  return function (key: string) {
    deleteProxyStorageProperty(storage, key)
  }
}

function setItem(
  storage: Record<string, any>,
) {
  return function (property: string, value: any, options?: StorageOptions) {
    return pThen(() => getProxyStorageProperty(storage, property), (res: StorageObject | string | null) => {
      const oldValue = isObject(res) ? res.value : (res || undefined)
      const oldOptions = isObject(res) ? res.options : {}

      const encodeValue = encode({ data: value, storage, property, options: Object.assign({}, oldOptions, options) })
      storage.setItem(property, encodeValue)

      emit(storage, property, value, getRaw(oldValue), property)

      if (isArray(value) && isArray(oldValue))
        emit(storage, `${property}.length`, value.length, oldValue.length)

      return true
    })
  }
}

const instrumentations: Record<string, Function> = createInstrumentations()
function createInstrumentations() {
  const nativeMethods: Record<string, Function> = {
    clear,
    getItem,
    setItem,
    removeItem,
  }

  const methods: Record<string, Function> = Object.assign({}, nativeMethods)

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
  for (const methodName in extendMethods) {
    methods[methodName] = function (storage: Record<string, any>) {
      return function (...args: any[]) {
        return extendMethods[methodName](storage, ...args)
      }
    }
  }

  return methods
}

function get(
  storage: Record<string, any>,
  property: string,
) {
  if (hasOwn(instrumentations, property))
    return instrumentations[property](storage)

  const data = storage[property]

  if (!isString(data) && data !== undefined)
    return isFunction(data) ? data.bind(storage) : data

  // priority: storage.getItem(property) > storage[property]
  return pThen(() => getProxyStorageProperty(storage, property), (res: StorageObject | string | null) => {
    const returnData = checkDisposable({ data: res, storage, property })
    return isObject(returnData) ? returnData.value : data
  })
}

function set(
  storage: Record<string, any>,
  property: string,
  value: any,
) {
  return setItem(storage)(property, value)
}

function deleteProperty(
  storage: Record<string, any>,
  property: string,
) {
  pThen(() => getProxyStorageProperty(storage, property), (res: StorageObject | string | null) => {
    deleteProxyStorageProperty(storage, property)

    const oldValue = isObject(res) ? res.value : (res || undefined)
    emit(storage, property, undefined, getRaw(oldValue), property)
  })

  return true
}

export function createProxyStorage(storage: StorageLike, name?: string) {
  if (!isStorage(storage))
    throw new Error('The parameter should be StorageLike object')

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
