import type { StorageStrategy } from './types'

export class SyncStrategy implements StorageStrategy {
  getItem(storage: any, key: string): string | null {
    return storage.getItem(key)
  }

  setItem(storage: any, key: string, value: string): void {
    storage.setItem(key, value)
  }

  removeItem(storage: any, key: string): void {
    storage.removeItem(key)
  }

  clear(storage: any): void {
    storage.clear()
  }

  key(storage: any, index: number): string | null {
    return storage.key(index)
  }

  length(storage: any): number {
    return typeof storage.length === 'function' ? storage.length() : storage.length
  }
}
