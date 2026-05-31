import type { AsyncStorageLike } from '@/types'

export interface ReactNativeAsyncStorage {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
  clear: () => Promise<void>
  getAllKeys: () => Promise<string[]>
}

export function createReactNativeStorage(asyncStorage: ReactNativeAsyncStorage): AsyncStorageLike {
  return {
    async getItem(key: string): Promise<string | null> {
      return asyncStorage.getItem(key)
    },
    async setItem(key: string, value: any): Promise<void> {
      await asyncStorage.setItem(key, value)
    },
    async removeItem(key: string): Promise<void> {
      await asyncStorage.removeItem(key)
    },
    async clear(): Promise<void> {
      await asyncStorage.clear()
    },
    async key(index: number): Promise<string | null> {
      const keys = await asyncStorage.getAllKeys()
      return keys[index] ?? null
    },
    async length(): Promise<number> {
      const keys = await asyncStorage.getAllKeys()
      return keys.length
    },
  }
}
