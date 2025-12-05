import type { StorageLike } from '@/types'

declare global {
  interface Window {
    stokado: {
      createProxyStorage: (storage: T, name?: string) => T
    }
    localforage: StorageLike & { length: (callback?: (err: any, numberOfKeys: number) => void) => Promise<number> }
  }
}
