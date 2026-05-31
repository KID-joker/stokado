import type { SyncStorageLike } from '@/types'

const map = new Map<string, string>()

export const memoryStorage: SyncStorageLike = {
  getItem(key: string): string | null {
    return map.get(key) ?? null
  },
  setItem(key: string, value: any): void {
    map.set(key, value)
  },
  removeItem(key: string): void {
    map.delete(key)
  },
  clear(): void {
    map.clear()
  },
  key(index: number): string | null {
    return [...map.keys()][index] ?? null
  },
  get length(): number {
    return map.size
  },
}
