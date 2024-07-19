import { getProxyStorageProperty } from '@/shared'
import type { StorageLike, StorageObject, StorageOptions } from '@/types'
import { isObject } from '@/utils'

export function getOptions(
  storage: StorageLike,
  property: string,
): StorageOptions {
  return getProxyStorageProperty(storage, property).then((res: StorageObject | string | null) => {
    if (isObject(res) && res.options)
      return res.options

    return {}
  }).value
}
