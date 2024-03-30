import { getProxyStorageProperty } from '@/shared'
import type { TargetObject } from '@/types'
import { isObject, pThen } from '@/utils'

export function getOptions(
  target: Record<string, any>,
  property: string,
) {
  const data = getProxyStorageProperty(target, property)

  return pThen(data, (res: TargetObject | string | null) => {
    if (isObject(res) && res.options)
      return res.options

    return {}
  })
}
