import type { StorageObject } from '@/types'

const proxyStorageMap = new WeakMap<Record<string, any>, Record<string, any>>()
export const storageNameMap = new WeakMap<Record<string, any>, string>()
export const proxyObjectMap = new WeakMap<Record<string, any>, Record<string, any>>()

export function setProxyStorage(storage: Record<string, any>, proxy: Record<string, any>): void {
    proxyStorageMap.set(storage, proxy)
}

export function getProxyStorage(storage: Record<string, any>) {
    return proxyStorageMap.get(storage)
}

export function clearProxyStorage(storage: Record<string, any>): void {
    storage.clear()
    proxyStorageMap.set(storage, {})
}

export function deleteProxyStorageProperty(storage: Record<string, any>, property: string) {
    const proxyStorage = proxyStorageMap.get(storage)
    storage.removeItem(property)
    if (proxyStorage)
        delete proxyStorage[property]
}

export function setProxyStorageProperty(storage: Record<string, any>, property: string, data: StorageObject) {
    const proxyStorage = proxyStorageMap.get(storage)
    if (proxyStorage)
        proxyStorage[property] = data
}

export function getRaw(value: any) {
    return proxyObjectMap.get(value) || value
}
