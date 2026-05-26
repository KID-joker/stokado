import type { Scheduler } from '@/scheduler/types'
import type { StorageStrategy } from '@/strategy/types'
import type { StorageOptions } from '@/types'
import type { BroadcastMessage } from '@/events/broadcast'
import { CacheStore } from '@/cache/store'
import { EventEmitter } from '@/events/emitter'
import { StorageBroadcast } from '@/events/broadcast'
import { encode } from '@/serializer/encode'
import { decode, type DecodedItem } from '@/serializer/decode'
import { createObjectProxy } from './proxy-object'
import { resolve, formatTime, getRawType, hasChanged, isObject } from '@/utils'

export class StorageOperator {
  private channelId: string | null

  constructor(
    public readonly storage: any,
    private scheduler: Scheduler,
    private strategy: StorageStrategy,
    public readonly cache: CacheStore,
    public readonly emitter: EventEmitter,
    private broadcast: StorageBroadcast,
    channelId?: string | null,
  ) {
    this.channelId = channelId ?? null
  }

  get isAsync(): boolean {
    return this.scheduler.isAsync
  }

  getItem(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached !== undefined) {
        if (this.isExpired(cached.options)) {
          return resolve(this.strategy.removeItem(this.storage, key), () => {
            this.cache.delete(key)
            return null
          })
        }
        if (cached.options?.disposable) {
          return resolve(this.strategy.removeItem(this.storage, key), () => {
            this.cache.delete(key)
            return this.extractValue(cached, key)
          })
        }
        return this.extractValue(cached, key)
      }

      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return null

        const decoded = decode(raw)
        if (decoded === null || typeof decoded === 'string') return decoded

        const item = decoded as DecodedItem
        this.cache.set(key, { value: item.value, type: item.type, options: item.options })

        if (this.isExpired(item.options)) {
          return resolve(this.strategy.removeItem(this.storage, key), () => {
            this.cache.delete(key)
            return null
          })
        }

        if (item.options?.disposable) {
          return resolve(this.strategy.removeItem(this.storage, key), () => {
            this.cache.delete(key)
            return this.wrapIfObject(item, key)
          })
        }

        return this.wrapIfObject(item, key)
      })
    })
  }

  setItem(key: string, value: any, options?: StorageOptions): any {
    return this.scheduler.enqueue(key, () => {
      const oldCached = this.cache.get(key)
      const oldValue = oldCached?.value
      const oldOptions = oldCached?.options ?? {}
      const mergedOptions = options ? { ...oldOptions, ...options } : oldOptions
      const encoded = encode(value, Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined)

      return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
        this.cache.deleteObjectProxy(key)
        this.cache.set(key, { value, type: getRawType(value), options: Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined })
        if (hasChanged(value, oldValue)) {
          this.emitter.emit(key, value, oldValue)
          this.broadcast.post({ type: 'set', key, encoded, channel: this.channelId ?? undefined })
        }

        if (Array.isArray(value) && Array.isArray(oldValue) && value.length !== oldValue.length) {
          this.emitter.emit(`${key}.length`, value.length, oldValue.length)
        }
      })
    })
  }

  removeItem(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const oldCached = this.cache.get(key)

      if (oldCached !== undefined) {
        const oldValue = oldCached.value
        return resolve(this.strategy.removeItem(this.storage, key), () => {
          this.cache.delete(key)
          this.emitter.emit(key, undefined, oldValue)
          this.broadcast.post({ type: 'remove', key, channel: this.channelId ?? undefined })
        })
      }

      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return

        return resolve(this.strategy.removeItem(this.storage, key), () => {
          this.cache.delete(key)
          const decoded = decode(raw)
          const item = typeof decoded !== 'string' && decoded !== null ? decoded as DecodedItem : null
          const oldValue = item?.value ?? raw
          this.emitter.emit(key, undefined, oldValue)
          this.broadcast.post({ type: 'remove', key, channel: this.channelId ?? undefined })
        })
      })
    })
  }

  clear(): any {
    const doFlush = this.scheduler.flushAll()
    return resolve(doFlush, () => {
      const cachedEntries = Array.from(this.cache.entries())
      return resolve(this.strategy.clear(this.storage), () => {
        this.cache.clear()
        for (const [key, cached] of cachedEntries) {
          this.emitter.emit(key, undefined, cached.value)
        }
        this.broadcast.post({ type: 'clear', channel: this.channelId ?? undefined })
      })
    })
  }

  key(index: number): any {
    return this.strategy.key(this.storage, index)
  }

  get length(): any {
    return this.strategy.length(this.storage)
  }

  setExpires(key: string, expires: any): any {
    const time = formatTime(expires)
    if (time <= Date.now()) {
      return this.removeItem(key)
    }

    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached) {
        const options = { ...cached.options, expires: time }
        const encoded = encode(cached.value, options)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { ...cached, options })
        })
      }
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return
        const decoded = decode(raw) as DecodedItem
        if (!decoded || typeof decoded === 'string') return
        const options = { ...decoded.options, expires: time }
        const encoded = encode(decoded.value, options)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { value: decoded.value, type: decoded.type, options })
        })
      })
    })
  }

  getExpires(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached?.options?.expires) {
        const exp = +cached.options.expires
        if (exp <= Date.now()) return undefined
        return new Date(exp)
      }
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return undefined
        const decoded = decode(raw) as DecodedItem
        if (!decoded || typeof decoded === 'string') return undefined
        if (!decoded.options?.expires) return undefined
        const exp = +decoded.options.expires
        if (exp <= Date.now()) return undefined
        return new Date(exp)
      })
    })
  }

  removeExpires(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached?.options?.expires) {
        const { expires, ...restOptions } = cached.options as any
        const newOptions = Object.keys(restOptions).length > 0 ? restOptions : undefined
        const encoded = encode(cached.value, newOptions)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { ...cached, options: newOptions })
        })
      }
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return
        const decoded = decode(raw) as DecodedItem
        if (!decoded || typeof decoded === 'string') return
        if (!decoded.options?.expires) return
        const { expires, ...restOptions } = decoded.options as any
        const newOptions = Object.keys(restOptions).length > 0 ? restOptions : undefined
        const encoded = encode(decoded.value, newOptions)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { value: decoded.value, type: decoded.type, options: newOptions })
        })
      })
    })
  }

  setDisposable(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached) {
        const options = { ...cached.options, disposable: true }
        const encoded = encode(cached.value, options)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { ...cached, options })
        })
      }
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return
        const decoded = decode(raw) as DecodedItem
        if (!decoded || typeof decoded === 'string') return
        const options = { ...decoded.options, disposable: true }
        const encoded = encode(decoded.value, options)
        return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
          this.cache.set(key, { value: decoded.value, type: decoded.type, options })
        })
      })
    })
  }

  getOptions(key: string): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (cached) return cached.options ?? {}
      return resolve(this.strategy.getItem(this.storage, key), (raw: string | null) => {
        if (raw === null) return {}
        const decoded = decode(raw) as DecodedItem
        if (!decoded || typeof decoded === 'string') return {}
        return decoded.options ?? {}
      })
    })
  }

  createObjectProxy(key: string, rawValue: object): object {
    let proxy = this.cache.getObjectProxy(key)
    if (!proxy) {
      proxy = createObjectProxy(rawValue, key, this)
      this.cache.setObjectProxy(key, proxy)
    }
    return proxy
  }

  onObjectPropertySet(key: string, target: object): any {
    return this.scheduler.enqueue(key, () => {
      const cached = this.cache.get(key)
      if (!cached) return
      const options = cached.options
      const encoded = encode(target, options)
      return resolve(this.strategy.setItem(this.storage, key, encoded), () => {
        this.cache.set(key, { value: target, type: getRawType(target), options })
        this.emitter.emit(key, target, target)
        this.broadcast.post({ type: 'set', key, encoded, channel: this.channelId ?? undefined })
      })
    })
  }

  handleBroadcast(msg: BroadcastMessage): void {
    if (this.channelId && msg.channel && this.channelId !== msg.channel) return

    switch (msg.type) {
      case 'set': {
        const decoded = decode(msg.encoded)
        if (decoded && typeof decoded !== 'string') {
          const item = decoded as DecodedItem
          if (this.isExpired(item.options)) {
            this.cache.delete(msg.key)
            break
          }
          const oldCached = this.cache.get(msg.key)
          this.cache.deleteObjectProxy(msg.key)
          this.cache.set(msg.key, { value: item.value, type: item.type, options: item.options })
          this.emitter.emit(msg.key, item.value, oldCached?.value)
        }
        break
      }
      case 'remove': {
        const oldCached = this.cache.get(msg.key)
        if (oldCached !== undefined) {
          this.cache.delete(msg.key)
          this.emitter.emit(msg.key, undefined, oldCached.value)
        }
        break
      }
      case 'clear': {
        const cachedEntries = Array.from(this.cache.entries())
        this.cache.clear()
        for (const [key, cached] of cachedEntries) {
          this.emitter.emit(key, undefined, cached.value)
        }
        break
      }
    }
  }

  private isExpired(options?: StorageOptions): boolean {
    if (!options?.expires) return false
    return new Date(+options.expires).getTime() <= Date.now()
  }

  private extractValue(cached: { value: any; type: string; options?: StorageOptions }, key: string): any {
    if (cached.type === 'Object' || cached.type === 'Array') {
      return this.createObjectProxy(key, cached.value)
    }
    return cached.value
  }

  private wrapIfObject(item: DecodedItem, key: string): any {
    if (item.type === 'Object' || item.type === 'Array') {
      return this.createObjectProxy(key, item.value)
    }
    return item.value
  }
}
