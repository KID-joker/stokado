import type { StorageStrategy } from './types'

export class AsyncStrategy implements StorageStrategy {
  async getItem(storage: any, key: string): Promise<string | null> {
    return await storage.getItem(key)
  }

  async setItem(storage: any, key: string, value: string): Promise<void> {
    await storage.setItem(key, value)
  }

  async removeItem(storage: any, key: string): Promise<void> {
    await storage.removeItem(key)
  }

  async clear(storage: any): Promise<void> {
    await storage.clear()
  }

  async key(storage: any, index: number): Promise<string | null> {
    return await storage.key(index)
  }

  async length(storage: any): Promise<number> {
    return typeof storage.length === 'function' ? await storage.length() : storage.length
  }
}
