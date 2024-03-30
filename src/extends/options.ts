import { getProxyStorageProperty } from '@/shared'
import type { StorageObject } from '@/types'
import { isObject, pThen } from '@/utils'

export function getOptions(
  storage: Record<string, any>,
  property: string,
) {
  const data = getProxyStorageProperty(storage, property)

  return pThen(data, (res: StorageObject | string | null) => {
    if (isObject(res) && res.options)
      return res.options

    return {}
  })
}
