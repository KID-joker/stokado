import { encode } from '@/proxy/transform'
import { getPrefix, proxyMap } from '@/shared'
import type { ExpiresType } from '@/types'
import { formatTime, isObject, transformJSON } from '@/utils'

export function setExpires(
  target: Record<string, any>,
  property: string,
  expires: ExpiresType,
  receiver: any,
) {
  const time = formatTime(expires)

  if (time <= Date.now()) {
    delete receiver[property]
    return undefined
  }

  const data = receiver[property]
  if (!data)
    return undefined

  const value = proxyMap.get(data) || data

  const key = `${getPrefix()}${property}`
  const oldValue = transformJSON(target[key])

  const options = { expires: time }
  if (isObject(oldValue))
    Object.assign(options, oldValue?.options)

  target[key] = encode(value, options)
  return new Date(time)
}

export function getExpires(
  target: Record<string, any>,
  property: string,
) {
  const key = `${getPrefix()}${property}`
  if (!target[key])
    return undefined

  const data = transformJSON(target[key])
  if (!isObject(data) || !data.options?.expires || +data.options.expires <= Date.now())
    return undefined

  return new Date(+data.options.expires)
}

export function removeExpires(
  target: Record<string, any>,
  property: string,
  receiver: any,
) {
  const data = receiver[property]
  if (!data)
    return undefined

  const value = proxyMap.get(data) || data

  target[`${getPrefix()}${property}`] = encode(value)

  return undefined
}
