import type { StorageLike, SyncStorageLike, AsyncStorageLike, ProxyStorageOptions, ProxyStorage, AsyncProxyStorage } from '@/types'
import { StorageOperator } from '@/core/operator'
import { createProxyHandler } from '@/core/proxy-handler'
import { SyncScheduler } from '@/scheduler/sync-scheduler'
import { AsyncScheduler } from '@/scheduler/async-scheduler'
import { SyncStrategy } from '@/strategy/sync-strategy'
import { AsyncStrategy } from '@/strategy/async-strategy'
import { CacheStore } from '@/cache/store'
import { EventEmitter } from '@/events/emitter'
import { StorageBroadcast } from '@/events/broadcast'
import { isFunction, isPromise } from '@/utils'

export { StorageOperator } from '@/core/operator'
export { encode } from '@/serializer/encode'
export { decode } from '@/serializer/decode'
export type { StorageOptions, StorageLike, SyncStorageLike, AsyncStorageLike, ProxyStorageOptions, ProxyStorage, AsyncProxyStorage, Listener } from '@/types'

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

  const operator = new StorageOperator(storage, scheduler, strategy, cache, emitter, broadcast, channelId)

  const proxy = new Proxy(storage, createProxyHandler(operator))

  broadcast.listen((msg) => operator.handleBroadcast(msg))

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
  if (typeof window !== 'undefined' && storage === window.sessionStorage) return false
  return broadcast ?? true
}

function resolveChannelId(storage: StorageLike, channel?: string): string | null {
  if (channel) return channel
  if (typeof window !== 'undefined') {
    if (storage === window.localStorage) return 'localStorage'
  }
  return null
}
