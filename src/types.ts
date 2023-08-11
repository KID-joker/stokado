export type RawType = 'String' | 'Number' | 'BigInt' | 'Boolean' | 'Null' | 'Undefined' | 'Object' | 'Array' | 'Set' | 'Map' | 'Date' | 'RegExp' | 'URL' | 'Function'
export type TrapType = 'apply' | 'construct' | 'defineProperty' | 'deleteProperty' | 'get' | 'getOwnPropertyDescriptor' | 'getPrototypeOf' | 'has' | 'isExtensible' | 'ownKeys' | 'preventExtensions' | 'set' | 'setPrototypeOf'

export interface StorageLike {
  [x: string]: any
  clear(): void
  getItem(key: string): string | null
  key(key: number): string | null
  setItem(key: string, value: string, options?: StorageOptions): void
  removeItem(key: string): void
  length: number
}
export type StorageValue = string | number | bigint | boolean | null | undefined | Object

export interface StorageOptions {
  expires?: ExpiresType
  disposable?: boolean
}

export interface ActiveEffect {
  storage: Record<string, any>
  key: string
  proxy: any
  options: StorageOptions
}

export type EffectMap = Map<string, Effect[]>
export type EffectFn<V = any, OV = any> = (
  value?: V,
  oldValue?: OV
) => any
export interface Effect {
  ctx: any
  fn: EffectFn
}

export interface TargetObject {
  type: string
  value: string | object
  options?: StorageOptions
}

export type ExpiresType = string | number | Date
