import type { StorageObject } from '@/types'
import { getProxyStorage } from '@/cache'
import { decode } from '@/proxy/transform'
import { pThen } from '@/utils'
import { checkExpired } from '@/check_expired'

export {
  clearProxyStorage,
  deleteProxyStorageProperty,
  getRaw,
  proxyObjectMap,
  setProxyStorage,
  setProxyStorageProperty,
  storageNameMap,
} from '@/cache'

export function getProxyStorageProperty(storage: Record<string, any>, property: string): StorageObject | string | null {
  const proxyStorage = getProxyStorage(storage)
  const data = proxyStorage![property] || pThen(() => storage.getItem(property), (res: string | null) => {
    const decoded = decode({ data: res, storage, property })
    // If decoded value is an object or array (proxy), cache it
    if (res && typeof res === 'string') {
      // We only cache if we actually decoded something from storage
      proxyStorage![property] = decoded
    }
    return decoded
  })
  return pThen(() => data, (res: StorageObject | string | null) => {
    return checkExpired({ data: res, storage, property })
  })
}
