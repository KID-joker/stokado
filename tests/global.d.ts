import type { StorageLike, ProxyStorageOptions } from '@/types'

declare global {
  interface Window {
    stokado: {
      createProxyStorage: (storage: T, options?: ProxyStorageOptions) => T
    }
    localforage: StorageLike & { length: (callback?: (err: any, numberOfKeys: number) => void) => Promise<number> }
  }
}
