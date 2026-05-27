import type { StorageOptions } from '@/types'

export interface CachedItem {
  value: any
  type: string
  options?: StorageOptions
}

export class CacheStore {
  private items = new Map<string, CachedItem>()
  private objectProxies = new Map<string, object>()

  get(key: string): CachedItem | undefined {
    return this.items.get(key)
  }

  set(key: string, item: CachedItem): void {
    this.items.set(key, item)
  }

  delete(key: string): void {
    this.items.delete(key)
    this.objectProxies.delete(key)
  }

  has(key: string): boolean {
    return this.items.has(key)
  }

  entries(): IterableIterator<[string, CachedItem]> {
    return this.items.entries()
  }

  clear(): void {
    this.items.clear()
    this.objectProxies.clear()
  }

  getObjectProxy(key: string): object | undefined {
    return this.objectProxies.get(key)
  }

  setObjectProxy(key: string, proxy: object): void {
    this.objectProxies.set(key, proxy)
  }

  deleteObjectProxy(key: string): void {
    this.objectProxies.delete(key)
  }
}
