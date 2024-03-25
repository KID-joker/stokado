import { getOptions } from './options'
import { encode } from '@/proxy/transform'
import { deleteProxyProperty, getProxyProperty } from '@/shared'
import type { ExpiresType, TargetObject } from '@/types'
import { formatTime, isObject, pThen } from '@/utils'

export function setExpires(
  target: Record<string, any>,
  property: string,
  expires: ExpiresType,
) {
  const time = formatTime(expires)

  if (time <= Date.now()) {
    deleteProxyProperty(target, property)
    return undefined
  }

  const data = getProxyProperty(target, property)

  pThen(data, (res: TargetObject | string | null) => {
    if (isObject(res)) {
      const options = Object.assign({}, res?.options, { expires: time })
      const encodeValue = encode({ data: res.value, target, property, options })
      target.setItem(property, encodeValue)
    }
  })
}

export function getExpires(
  target: Record<string, any>,
  property: string,
) {
  const options = getOptions(target, property)

  if (!options?.expires || +options.expires <= Date.now())
    return undefined

  return new Date(+options.expires)
}

export function removeExpires(
  target: Record<string, any>,
  property: string,
) {
  const data = getProxyProperty(target, property)

  pThen(data, (res: TargetObject | string | null) => {
    if (isObject(res) && res.options) {
      delete res.options.expires
      const encodeValue = encode({ data: res.value, target, property, options: res.options })
      target.setItem(property, encodeValue)
    }
  })
}

export function checkExpired({
  data,
  target,
  property,
}: {
  data: TargetObject | string | null
  target: Record<string, any>
  property: string
}) {
  if (!isObject(data) || !data.options)
    return data

  const { expires } = data.options

  if (expires && new Date(+expires).getTime() <= Date.now()) {
    deleteProxyProperty(target, property)
    data.value = undefined
  }

  return data
}
