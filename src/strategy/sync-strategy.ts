import type { StorageLike } from '@/types'
import type { StorageStrategy } from './types'

export class SyncStrategy implements StorageStrategy {
  getItem(storage: StorageLike, key: string): string | null {
    return storage.getItem(key)
  }

  setItem(storage: StorageLike, key: string, value: string): void {
    storage.setItem(key, value)
  }

  removeItem(storage: StorageLike, key: string): void {
    storage.removeItem(key)
  }

  clear(storage: StorageLike): void {
    storage.clear()
  }

  key(storage: StorageLike, index: number): string | null {
    return storage.key(index)
  }

  length(storage: StorageLike): number {
    return typeof storage.length === 'function' ? storage.length() : storage.length
  }
}
