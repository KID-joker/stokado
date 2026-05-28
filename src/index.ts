import type { AsyncProxyStorage, AsyncStorageLike, ProxyStorage, ProxyStorageOptions, StorageLike, SyncStorageLike } from '@/types'
import { CacheStore } from '@/cache/store'
import { StorageOperator } from '@/core/operator'
import { createProxyHandler } from '@/core/proxy-handler'
import { StorageBroadcast } from '@/events/broadcast'
import { EventEmitter } from '@/events/emitter'
import { SizeTracker } from '@/quota/size-tracker'
import { AsyncScheduler } from '@/scheduler/async-scheduler'
import { SyncScheduler } from '@/scheduler/sync-scheduler'
import { AsyncStrategy } from '@/strategy/async-strategy'
import { SyncStrategy } from '@/strategy/sync-strategy'
import { isFunction, isPromise } from '@/utils'

export { StorageOperator } from '@/core/operator'
export { SizeTracker } from '@/quota/size-tracker'
export { decode } from '@/serializer/decode'
export { encode } from '@/serializer/encode'
export type { AsyncProxyStorage, AsyncStorageLike, Listener, ProxyStorage, ProxyStorageOptions, QuotaInfo, StorageLike, StorageOptions, SyncStorageLike } from '@/types'

export const KB = 1024
export const MB = 1024 * KB

export function createProxyStorage(storage: SyncStorageLike, options?: ProxyStorageOptions): ProxyStorage
export function createProxyStorage(storage: AsyncStorageLike, options?: ProxyStorageOptions): AsyncProxyStorage
export function createProxyStorage(storage: StorageLike, options?: ProxyStorageOptions) {
  validateStorage(storage)

  const isAsync = detectAsync(storage)

  const broadcastEnabled = shouldEnableBroadcast(storage, options?.broadcast)
  const channelId = broadcastEnabled ? resolveChannelId(storage, options?.channel) : null

  const scheduler = isAsync ? new AsyncScheduler() : new SyncScheduler()
  const strategy = isAsync ? new AsyncStrategy() : new SyncStrategy()
  const cache = new CacheStore()
  const emitter = new EventEmitter()
  const broadcast = new StorageBroadcast(channelId)

  const sizeTracker = options?.quota
    ? new SizeTracker(options.quota, options.onQuotaExceeded)
    : null

  const operator = new StorageOperator(storage, scheduler, strategy, cache, emitter, broadcast, sizeTracker)

  const initResult = sizeTracker?.init(storage, { isAsync })
  const ready = initResult instanceof Promise ? initResult : Promise.resolve()

  const proxy = new Proxy(storage, createProxyHandler(operator, sizeTracker, ready))

  broadcast.listen(msg => operator.handleBroadcast(msg))

  return proxy
}

function validateStorage(storage: StorageLike): void {
  const required = ['getItem', 'setItem', 'removeItem', 'clear', 'key']
  for (const method of required) {
    if (!isFunction(storage[method])) {
      throw new Error(`Invalid storage: missing ${method} method`)
    }
  }
}

function detectAsync(storage: StorageLike): boolean {
  const probe = storage.getItem('__stokado_probe__')
  return isPromise(probe)
}

function shouldEnableBroadcast(storage: StorageLike, broadcast?: boolean): boolean {
  if (typeof window !== 'undefined' && storage === window.sessionStorage)
    return false
  return broadcast ?? true
}

function resolveChannelId(storage: StorageLike, channel?: string): string | null {
  if (channel)
    return channel
  if (typeof window !== 'undefined') {
    if (storage === window.localStorage)
      return 'localStorage'
  }
  return null
}
