import type { StorageLike } from '@/types'

export interface StorageStrategy {
  getItem: (storage: StorageLike, key: string) => string | null | Promise<string | null>
  setItem: (storage: StorageLike, key: string, value: string) => void | Promise<void>
  removeItem: (storage: StorageLike, key: string) => void | Promise<void>
  clear: (storage: StorageLike) => void | Promise<void>
  key: (storage: StorageLike, index: number) => string | null | Promise<string | null>
  length: (storage: StorageLike) => number | Promise<number>
}
