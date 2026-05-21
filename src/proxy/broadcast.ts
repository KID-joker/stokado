import type { StorageLike } from '@/types'
import { trigger } from '@/effect'
import { decode, encode } from '@/proxy/transform'
import { storageNameMap } from '@/cache'
import { pThen } from '@/utils'

const storageChannelMap = new Map<string, BroadcastChannel>()

// Broadcast changes to other tabs/windows
export function postMessage(storage: object, key: string, value: any, oldValue: any, property?: string) {
  const storageName = storageNameMap.get(storage)
  if (!storageName)
    return

  const channel = storageChannelMap.get(storageName)
  console.log('postMessage', key, storageName)
  channel?.postMessage({
    key,
    newValue: encode({ data: value }),
    oldValue: encode({ data: oldValue }),
    property,
  })
}

// Listen for changes from other tabs/windows
export function listenMessage(storage: StorageLike) {
  const storageName = storageNameMap.get(storage)!

  let channel = storageChannelMap.get(storageName)
  if (!channel)
    storageChannelMap.set(storageName, (channel = new BroadcastChannel(`stokado:${storageName}`)))

  channel.onmessage = function (ev: MessageEvent) {
    const { key, newValue, oldValue, property } = ev.data
    const newDecoded = decode({ data: newValue })
    const oldDecoded = decode({ data: oldValue })

    trigger(storage, key, newDecoded?.value, oldDecoded?.value)

    // update proxyStorage
    if (property) {
      pThen(() => storage.getItem(property), (res: string | null) => {
        return decode({ data: res, storage, property })
      })
    }
  }
}
