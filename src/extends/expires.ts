import { encode } from '../proxy/transform'
import { getPrefix, proxyMap } from '../shared'
import type { ExpiresType } from '../types'
import { isDate, isObject, isString, transformJSON } from '../utils'

export function setExpires(
  target: Record<string, any>,
  property: string,
  value: ExpiresType,
  receiver: any,
) {
  let time: number
  if (isDate(value))
    time = value.getTime()
  else if (isString(value))
    time = +value.padEnd(13, '0')
  else
    time = value

  if (time <= Date.now()) {
    delete receiver[property]
    return undefined
  }

  let data = receiver[property]
  if (!data)
    return undefined

  data = proxyMap.get(data) || data

  target[`${getPrefix()}${property}`] = encode(data, `${time}`)
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
  if (!isObject(data) || !data.expires || +data.expires <= Date.now())
    return undefined

  return new Date(+data.expires)
}

export function removeExpires(
  target: Record<string, any>,
  property: string,
  receiver: any,
) {
  let data = receiver[property]
  if (!data)
    return undefined

  data = proxyMap.get(data) || data

  target[`${getPrefix()}${property}`] = encode(data)

  return undefined
}
