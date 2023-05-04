import { encode } from '@/proxy/transform'
import { getPrefix, proxyMap } from '@/shared'
import { isObject, transformJSON } from '@/utils'

export function setDisposable(
  target: Record<string, any>,
  property: string,
  receiver: any,
) {
  const data = receiver[property]
  if (!data)
    return undefined

  const value = proxyMap.get(data) || data

  const key = `${getPrefix()}${property}`
  const oldValue = transformJSON(target[key])

  const options = { disposable: true }
  if (isObject(oldValue))
    Object.assign(options, oldValue?.options)

  return target[key] = encode(value, options)
}
