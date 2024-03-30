import { checkExpired } from './extends/expires'
import { decode } from '@/proxy/transform'
import type { StorageObject } from '@/types'
import { pThen } from '@/utils'

const proxyStorageMap = new WeakMap<Record<string, any>, Record<string, any>>()
export const storageNameMap = new WeakMap<Record<string, any>, string>()

export function setProxyStorage(storage: Record<string, any>, proxy: Record<string, any>): void {
  proxyStorageMap.set(storage, proxy)
}

export function clearProxyStorage(storage: Record<string, any>): void {
  storage.clear()
  proxyStorageMap.set(storage, {})
}

export function getProxyStorageProperty(storage: Record<string, any>, property: string): StorageObject | string | null {
  const proxyStorage = proxyStorageMap.get(storage)
  const data = proxyStorage![property] || pThen(storage.getItem(property), (res: string | null) => {
    return decode({ data: res, storage, property })
  })
  return pThen(data, (res: StorageObject | string | null) => {
    return checkExpired({ data: res, storage, property })
  })
}

export function deleteProxyStorageProperty(storage: Record<string, any>, property: string) {
  const proxyStorage = proxyStorageMap.get(storage)
  storage.removeItem(property)
  delete proxyStorage![property]
}

export function setProxyStorageProperty(storage: Record<string, any>, property: string, data: StorageObject) {
  const proxyStorage = proxyStorageMap.get(storage)
  proxyStorage![property] = data
}

export const proxyObjectMap = new WeakMap<Record<string, any>, Record<string, any>>()
export function getRaw(value: any) {
  return proxyObjectMap.get(value) || value
}
