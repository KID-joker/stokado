import type { StorageLike } from '@/types'
import type { StorageStrategy } from './types'

export class AsyncStrategy implements StorageStrategy {
  async getItem(storage: StorageLike, key: string): Promise<string | null> {
    return await storage.getItem(key)
  }

  async setItem(storage: StorageLike, key: string, value: string): Promise<void> {
    await storage.setItem(key, value)
  }

  async removeItem(storage: StorageLike, key: string): Promise<void> {
    await storage.removeItem(key)
  }

  async clear(storage: StorageLike): void | Promise<void> {
    await storage.clear()
  }

  async key(storage: StorageLike, index: number): Promise<string | null> {
    return await storage.key(index)
  }

  async length(storage: StorageLike): Promise<number> {
    return typeof storage.length === 'function' ? await storage.length() : storage.length
  }
}
