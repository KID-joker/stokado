import { decode, encode } from './transform'
import { trigger } from '@/extends/watch'
import { getRaw, storageNameMap, updateProxyStorageProperty } from '@/shared'
import type { StorageLike } from '@/types'

const storageChannelMap = new Map<string, BroadcastChannel>()

export function postMessage(storage: StorageLike, key: string, value: any, oldValue: any, property?: string) {
  const storageName = storageNameMap.get(storage)
  if (!storageName)
    return

  const channel = storageChannelMap.get(storageName)
  channel?.postMessage({
    key,
    newValue: encode(value),
    oldValue: encode(oldValue),
    property,
  })
}

export function listenMessage(storage: StorageLike) {
  const storageName = storageNameMap.get(storage)!

  let channel = storageChannelMap.get(storageName)
  if (!channel)
    storageChannelMap.set(storageName, (channel = new BroadcastChannel(`stokado:${storageName}`)))

  channel.onmessage = function (ev: MessageEvent) {
    const { key, newValue, oldValue, property } = ev.data

    trigger(storage, key, getRaw(decode(newValue).value), getRaw(decode(oldValue).value))

    // update proxyStorage
    if (property)
      updateProxyStorageProperty(storage, property)
  }
}
