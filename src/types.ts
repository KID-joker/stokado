export type RawType = 'String' | 'Number' | 'BigInt' | 'Boolean' | 'Null' | 'Undefined' | 'Object' | 'Array' | 'Set' | 'Map' | 'Date' | 'RegExp' | 'Function'

export interface StorageLike {
  [x: string]: any
  clear(): void
  getItem(key: string): string | null
  key(key: number): string | null
  setItem(key: string, value: string, options?: StorageOptions): void
  removeItem(key: string): void
  length: number
}
export type StorageValue = string | object | null

export interface StorageOptions {
  expires?: ExpiresType
  disposable?: boolean
}

export interface ActiveEffect {
  storage: object
  key: string
  proxy: any
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
