export type RawType = 'String' | 'Number' | 'BigInt' | 'Boolean' | 'Null' | 'Undefined' | 'Object' | 'Array' | 'Set' | 'Map' | 'Date' | 'RegExp' | 'URL' | 'Function'

export interface StorageLike {
  [x: string | symbol]: any
  clear(): void
  getItem(key: string): string | null | Promise<string | null>
  key(key: number): string | null | Promise<string | null>
  setItem(key: string, value: any, options?: StorageOptions): void
  removeItem(key: string): void
  length: number
}
export type StorageValue = string | number | bigint | boolean | null | undefined | Object

export interface StorageOptions {
  expires?: ExpiresType
  disposable?: boolean
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

export interface StorageObject {
  type: string
  value: any
  options?: StorageOptions
}

export type ExpiresType = string | number | Date

export interface ProxyObject {
  readonly storage: StorageLike
  readonly property: string
}
