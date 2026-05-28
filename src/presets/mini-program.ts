import type { AsyncStorageLike, SyncStorageLike } from '@/types'

export interface MiniProgramSyncAPI {
  getStorageSync: (key: string) => any
  setStorageSync: (key: string, data: any) => void
  removeStorageSync: (key: string) => void
  clearStorageSync: () => void
  getStorageInfoSync: () => { keys: string[], currentSize: number, limitSize: number }
}

export interface MiniProgramAsyncAPI {
  getStorage: (options: { key: string }) => Promise<{ data: any }>
  setStorage: (options: { key: string, data: any }) => Promise<void>
  removeStorage: (options: { key: string }) => Promise<void>
  clearStorage: () => Promise<void>
  getStorageInfo: () => Promise<{ keys: string[], currentSize: number, limitSize: number }>
}

export function createMiniProgramStorage(api: MiniProgramSyncAPI): SyncStorageLike {
  return {
    getItem(key: string): string | null {
      const value = api.getStorageSync(key)
      return value === '' ? null : value
    },
    setItem(key: string, value: any): void {
      api.setStorageSync(key, value)
    },
    removeItem(key: string): void {
      api.removeStorageSync(key)
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

export function createMiniProgramStorageAsync(api: MiniProgramAsyncAPI): AsyncStorageLike {
  return {
    async getItem(key: string): Promise<string | null> {
      const { data } = await api.getStorage({ key })
      return data === '' ? null : data
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
