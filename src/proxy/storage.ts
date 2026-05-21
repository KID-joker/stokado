import type { StorageLike, StorageObject, StorageOptions } from '@/types'
import '@/proxy/object'
import { checkDisposable, setDisposable } from '@/extends/disposable'
import { getExpires, removeExpires, setExpires } from '@/extends/expires'
import { getOptions } from '@/extends/options'
import { emit, off, on, once } from '@/extends/watch'
import { listenMessage } from '@/proxy/broadcast'
import { decode, encode } from '@/proxy/transform'
import { clearProxyStorage, deleteProxyStorageProperty, getRaw, setProxyStorage, setProxyStorageProperty, storageNameMap } from '@/cache'
import { getProxyStorageProperty } from '@/shared'
import { hasOwn, isArray, isFunction, isLocalStorage, isObject, isStorage, isString, pThen } from '@/utils'

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

      const mergedOptions = Object.assign({}, oldOptions, options)
      // We need to construct the storage object manually to cache it correctly
      // But wait, encode returns string. We need the object form for setProxyStorageProperty.
      // transform.ts doesn't export the object creation logic easily?
      // Actually `encode` makes a `StorageObject`.
      // The `value` here is raw value. `setProxyStorageProperty` expects a StorageObject { type, value, options }.
      // But `value` in StorageObject is the SERIALIZED value for primitives, or PROXY for objects?
      // Let's check shared.ts/transform.ts.
      // transform.ts: `serializer.read` returns the proxy.
      // `encode` uses `serializer.write`.
      // `setProxyStorageProperty` stores what `decode` returns.
      // `decode` returns { type, value: proxy/primitive, options }.
      // So here in setItem, if we want to update cache, we need the "decoded" form of the value.
      // If `value` is an object, we probably want to cache the proxy?
      // Or maybe we don't need to cache on `setItem` if `get` will do it?
      // But `on` changes rely on cache? No.
      // If we don't cache here, next `get` will read `encodeValue` string and decode it.
      // If `value` was an object, `get` will create a NEW proxy.
      // PROXY EQUALITY ISSUE: If we set an object, we want `get` to return the *same* proxy if possible?
      // Current usage: `setItem` replaces the value. So a new proxy is expected?
      // If I set `storage.a = {}`. `storage.a` is a new proxy.
      // Old `transform.ts`:
      // `setProxyStorageProperty(..., { type, value: serializer.read(...), options })`
      // So yes, it created a proxy and cached it.
      // Accessing `value` directly is NOT enough because `value` is raw.
      // We need to proxy it if it's an object.
      // `decode` does exactly that.
      // So: const encoded = encode(...); storage.setItem(..., encoded);
      // const decoded = decode({ data: encoded, storage, property }); -> this creates new proxy : (
      // But `value` passed to `setItem` might ALREADY be a proxy?
      // `getRaw(value)` handles that?
      // If `value` is raw object.
      // We want to cache the proxy.
      // We can use `decode` on the *result* of `encode`?
      // Yes. `encode` returns JSON string. `decode` turns it back to proxy.
      // Ideally we don't double work.
      // But given we removed `simpleEncode` and side effects...
      // Let's just use decode on the encoded string to populate cache.

      const encodeValue = encode({ data: value, options: mergedOptions })
      storage.setItem(property, encodeValue)

      // Update cache by decoding what we just wrote (or more efficiently?)
      // decode is consistent.
      // But we need to update cache synchronously?
      // decode is synchronous.
      // wait, `encode` returns string.
      // We can replicate logic:
      // But `transform.ts` logic is complex (serializers).
      // Calling `decode` is safest to ensure consistency.
      const decoded = decode({ data: encodeValue, storage, property })
      // decode doesn't auto-cache anymore, we fixed shared.ts to do it inside getProxyStorageProperty? 
      // No, we fixed `getProxyStorageProperty` to cache result of `decode`.
      // But here we are calling `decode` manually.
      // So we must manually cache.
      setProxyStorageProperty(storage, property, decoded)


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
