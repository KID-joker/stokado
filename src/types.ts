export type RawType = 'String' | 'Number' | 'BigInt' | 'Boolean' | 'Null' | 'Undefined' | 'Object' | 'Array' | 'Set' | 'Map' | 'Date' | 'RegExp' | 'URL' | 'Function'

export interface SyncStorageLike {
  [x: string]: any
  clear: () => void
  getItem: (key: string) => string | null
  key: (key: number) => string | null
  setItem: (key: string, value: any, options?: StorageOptions) => void
  removeItem: (key: string) => void
  length: number
}

export interface AsyncStorageLike {
  [x: string]: any
  clear: () => Promise<void>
  getItem: (key: string) => Promise<string | null>
  key: (key: number) => Promise<string | null>
  setItem: (key: string, value: any, options?: StorageOptions) => Promise<void>
  removeItem: (key: string) => Promise<void>
  length: () => Promise<number>
}

export type StorageLike = SyncStorageLike | AsyncStorageLike
export type StorageValue = string | number | bigint | boolean | null | undefined | object

export interface StorageOptions {
  expires?: ExpiresType
  disposable?: boolean
}

export type ExpiresType = string | number | Date

export interface QuotaInfo {
  current: number
  limit: number
  key: string
  value: any
}

export interface ProxyStorageOptions {
  broadcast?: boolean
  channel?: string
  quota?: number
  onQuotaExceeded?: (info: QuotaInfo) => boolean | void | Promise<boolean | void>
}

export interface ProxyStorage extends SyncStorageLike {
  on: (key: string, fn: Listener) => void
  once: (key: string, fn: Listener) => void
  off: (key?: string, fn?: Listener) => void
  setExpires: (key: string, expires: ExpiresType) => void
  getExpires: (key: string) => Date | undefined
  removeExpires: (key: string) => void
  setDisposable: (key: string) => void
  getOptions: (key: string) => StorageOptions | null
  getUsage: () => { current: number, limit: number }
  ready: Promise<void>
}

export interface AsyncProxyStorage extends AsyncStorageLike {
  on: (key: string, fn: Listener) => void
  once: (key: string, fn: Listener) => void
  off: (key?: string, fn?: Listener) => void
  setExpires: (key: string, expires: ExpiresType) => Promise<void>
  getExpires: (key: string) => Promise<Date | undefined>
  removeExpires: (key: string) => Promise<void>
  setDisposable: (key: string) => Promise<void>
  getOptions: (key: string) => Promise<StorageOptions | null>
  getUsage: () => Promise<{ current: number, limit: number }>
  ready: Promise<void>
}

export type Listener = (newValue: any, oldValue: any) => void
