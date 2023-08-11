import { encode } from '@/proxy/transform'
import { deleteProxyProperty, prefixInst } from '@/shared'
import type { ExpiresType, TargetObject } from '@/types'
import { formatTime, isObject, isString, transformJSON } from '@/utils'

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

  const key = `${prefixInst.getPrefix()}${property}`

  const data = target[key]
  if (!data)
    return undefined

  const originalData = transformJSON(data)

  const options = isObject(originalData) ? Object.assign({}, originalData?.options, { expires: time }) : { expires: time }

  target[key] = encode({ data: isObject(originalData) ? originalData.value : originalData, target, property, options })
  return new Date(time)
}

export function getExpires(
  target: Record<string, any>,
  property: string,
) {
  const key = `${prefixInst.getPrefix()}${property}`
  const data = target[key]
  if (!data)
    return undefined

  const originalData = transformJSON(data)
  if (!isObject(originalData) || !originalData.options?.expires || +originalData.options.expires <= Date.now())
    return undefined

  return new Date(+originalData.options.expires)
}

export function removeExpires(
  target: Record<string, any>,
  property: string,
) {
  const key = `${prefixInst.getPrefix()}${property}`

  const data = target[key]
  if (!data)
    return undefined

  const originalData = transformJSON(data)
  if (!isObject(originalData) || !originalData.options)
    return undefined

  delete originalData!.options!.expires

  target[key] = encode({ data: originalData.value, target, property, options: originalData.options })
}

export function isExpired({
  data,
  target,
  property,
}: {
  data: string
  target: Record<string, any>
  property: string
}) {
  if (!isString(data)) {
    return {
      data,
      target,
      property,
    }
  }

  const originalData: TargetObject | string = transformJSON(data)

  if (isObject(originalData) && originalData.options) {
    const { expires } = originalData.options

    if (expires && new Date(+expires).getTime() <= Date.now()) {
      delete target[property]
      deleteProxyProperty(target, property)

      return {
        data: undefined,
        target,
        property,
      }
    }
  }

  return {
    data,
    target,
    property,
  }
}
