import type { Thenable } from 'then-ref'
import ThenRef from 'then-ref'
import { checkExpired } from './extends/expires'
import { SymbolStorageMethods, isArray, isObject } from './utils'
import { decode, encode } from '@/proxy/transform'
import type { StorageLike, StorageOptions } from '@/types'

const proxyStorageMap = new WeakMap<StorageLike, Record<string, any>>()
export const storageNameMap = new WeakMap<StorageLike, string>()

export function setProxyStorage(storage: StorageLike, proxy: Record<string, any>): void {
  proxyStorageMap.set(storage, proxy)
}

export function clearProxyStorage(storage: StorageLike): void {
  storage.clear()
  proxyStorageMap.set(storage, {})
}

export function getProxyStorageProperty(storage: StorageLike, property: string): Thenable {
  const proxyStorage = proxyStorageMap.get(storage)
  const data = proxyStorage![property]
  if (!data)
    return updateProxyStorageProperty(storage, property)

  return ThenRef(checkExpired)(data, storage, property)
}

export function deleteProxyStorageProperty(storage: StorageLike, property: string) {
  const proxyStorage = proxyStorageMap.get(storage)
  delete proxyStorage![property]
  return storage[SymbolStorageMethods.get('removeItem')!](property)
}

export function setProxyStorageProperty(storage: StorageLike, property: string, data: any, options?: StorageOptions) {
  const encodeValue = encode(data, options)
  return storage[SymbolStorageMethods.get('setItem')!](property, encodeValue).then(() => {
    updateProxyStorageProperty(storage, property)
  })
}

export function updateProxyStorageProperty(storage: StorageLike, property: string): Thenable {
  return storage[SymbolStorageMethods.get('getItem')!](property).then((res: string | null) => {
    const data = decode(res, (value: any) => {
      if (isObject(value) || isArray(value)) {
        Object.defineProperties(value, {
          storage: {
            value: storage,
          },
          property: {
            value: property,
          },
        })
      }
    })

    const proxyStorage = proxyStorageMap.get(storage)
    proxyStorage![property] = data
    return checkExpired(data, storage, property)
  })
}

const proxyObjectMap = new WeakMap<Record<string, any>, Record<string, any>>()
export function getRaw(value: any) {
  return proxyObjectMap.get(value) || value
}
export function setRaw(proxy: Record<string, any>, value: Record<string, any>) {
  proxyObjectMap.set(proxy, value)
}
