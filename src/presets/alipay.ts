import type { AsyncStorageLike, SyncStorageLike } from '@/types'

export interface AlipaySyncAPI {
  getStorageSync: (options: { key: string }) => { data: any }
  setStorageSync: (options: { key: string, data: any }) => void
  removeStorageSync: (options: { key: string }) => void
  clearStorageSync: () => void
  getStorageInfoSync: () => { keys: string[], currentSize: number, limitSize: number }
}

export interface AlipayAsyncAPI {
  getStorage: (options: { key: string }) => Promise<{ data: any }>
  setStorage: (options: { key: string, data: any }) => Promise<void>
  removeStorage: (options: { key: string }) => Promise<void>
  clearStorage: () => Promise<void>
  getStorageInfo: () => Promise<{ keys: string[], currentSize: number, limitSize: number }>
}

declare const my: AlipaySyncAPI & AlipayAsyncAPI

export function createAlipayStorage(api: AlipaySyncAPI): SyncStorageLike {
  return {
    getItem(key: string): string | null {
      const { data } = api.getStorageSync({ key })
      return data ?? null
    },
    setItem(key: string, value: any): void {
      api.setStorageSync({ key, data: value })
    },
    removeItem(key: string): void {
      api.removeStorageSync({ key })
    },
    clear(): void {
      api.clearStorageSync()
    },
    key(index: number): string | null {
      return api.getStorageInfoSync().keys[index] ?? null
    },
    get length(): number {
      return api.getStorageInfoSync().keys.length
    },
  }
}

export function createAlipayStorageAsync(api: AlipayAsyncAPI): AsyncStorageLike {
  return {
    async getItem(key: string): Promise<string | null> {
      const { data } = await api.getStorage({ key })
      return data ?? null
    },
    async setItem(key: string, value: any): Promise<void> {
      await api.setStorage({ key, data: value })
    },
    async removeItem(key: string): Promise<void> {
      await api.removeStorage({ key })
    },
    async clear(): Promise<void> {
      await api.clearStorage()
    },
    async key(index: number): Promise<string | null> {
      const { keys } = await api.getStorageInfo()
      return keys[index] ?? null
    },
    async length(): Promise<number> {
      const { keys } = await api.getStorageInfo()
      return keys.length
    },
  }
}

export const alipayStorage: SyncStorageLike = new Proxy({} as SyncStorageLike, {
  get(_, prop) {
    return createAlipayStorage(my)[prop as keyof SyncStorageLike]
  },
})
export const alipayStorageAsync: AsyncStorageLike = new Proxy({} as AsyncStorageLike, {
  get(_, prop) {
    return createAlipayStorageAsync(my)[prop as keyof AsyncStorageLike]
  },
})
