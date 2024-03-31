import { getProxyStorageProperty } from '@/shared'
import type { StorageObject } from '@/types'
import { isObject, pThen } from '@/utils'

export function getOptions(
  storage: Record<string, any>,
  property: string,
) {
  return pThen(() => getProxyStorageProperty(storage, property), (res: StorageObject | string | null) => {
    if (isObject(res) && res.options)
      return res.options

    return {}
  })
}
