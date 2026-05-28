import type { QuotaInfo } from '@/types'
import { byteSize } from './byte-size'

export interface InitContext {
  isAsync: boolean
}

export class SizeTracker {
  private sizeMap = new Map<string, number>()
  private _current = 0
  private _limit: number
  private _onQuotaExceeded?: (info: QuotaInfo) => boolean | void | Promise<boolean | void>

  constructor(limit: number, onQuotaExceeded?: (info: QuotaInfo) => boolean | void | Promise<boolean | void>) {
    this._limit = limit
    this._onQuotaExceeded = onQuotaExceeded
  }

  get current(): number {
    return this._current
  }

  get limit(): number {
    return this._limit
  }

  init(storage: any, context: InitContext): void | Promise<void> {
    if (context.isAsync) {
      return this._initAsync(storage)
    }
    this._initSync(storage)
  }

  add(key: string, encoded: string): void {
    const newSize = byteSize(key) + byteSize(encoded)
    const oldSize = this.sizeMap.get(key) ?? 0
    this.sizeMap.set(key, newSize)
    this._current += newSize - oldSize
  }

  remove(key: string): void {
    const oldSize = this.sizeMap.get(key)
    if (oldSize !== undefined) {
      this._current -= oldSize
      this.sizeMap.delete(key)
    }
  }

  clear(): void {
    this.sizeMap.clear()
    this._current = 0
  }

  check(key: string, encoded: string, value: any): boolean | Promise<boolean> {
    const newSize = byteSize(key) + byteSize(encoded)
    const oldSize = this.sizeMap.get(key) ?? 0
    const delta = newSize - oldSize

    if (this._current + delta <= this._limit) {
      return true
    }

    if (!this._onQuotaExceeded) {
      return true
    }

    const result = this._onQuotaExceeded({
      current: this._current + delta,
      limit: this._limit,
      key,
      value,
    })

    if (result instanceof Promise) {
      return result.then(r => r !== false)
    }

    return result !== false
  }

  getUsage(): { current: number, limit: number } {
    return { current: this._current, limit: this._limit }
  }

  private _initSync(storage: any): void {
    const len = typeof storage.length === 'function' ? storage.length() : storage.length
    for (let i = 0; i < len; i++) {
      const key = storage.key(i)
      if (key === null || key === '__stokado_probe__')
        continue
      const raw = storage.getItem(key)
      if (raw !== null) {
        const size = byteSize(key) + byteSize(raw)
        this.sizeMap.set(key, size)
        this._current += size
      }
    }
  }

  private async _initAsync(storage: any): Promise<void> {
    const len = typeof storage.length === 'function' ? await storage.length() : storage.length
    for (let i = 0; i < len; i++) {
      const key = await storage.key(i)
      if (key === null || key === '__stokado_probe__')
        continue
      const raw = await storage.getItem(key)
      if (raw !== null) {
        const size = byteSize(key) + byteSize(raw)
        this.sizeMap.set(key, size)
        this._current += size
      }
    }
  }
}
