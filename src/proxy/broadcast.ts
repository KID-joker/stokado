import { trigger } from '@/extends/watch'
import { decode, simpleDecode, simpleEncode } from '@/proxy/transform'
import { storageNameMap } from '@/shared'
import type { StorageLike } from '@/types'
import { pThen } from '@/utils'

const storageChannelMap = new Map<string, BroadcastChannel>()

export function postMessage(storage: object, key: string, value: any, oldValue: any, property?: string) {
  const storageName = storageNameMap.get(storage)
  if (!storageName)
    return

  const channel = storageChannelMap.get(storageName)
  channel?.postMessage({
    key,
    newValue: simpleEncode(value),
    oldValue: simpleEncode(oldValue),
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
    trigger(storage, key, simpleDecode(newValue), simpleDecode(oldValue))

    // update proxyStorage
    if (property) {
      pThen(() => storage.getItem(property), (res: string | null) => {
        return decode({ data: res, storage, property })
      })
    }
  }
}
