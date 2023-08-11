import { encode } from '@/proxy/transform'
import { deleteProxyProperty, prefixInst } from '@/shared'
import type { TargetObject } from '@/types'
import { isObject, isString, transformJSON } from '@/utils'

export function setDisposable(
  target: Record<string, any>,
  property: string,
) {
  const key = `${prefixInst.getPrefix()}${property}`

  const data = target[key]
  if (!data)
    return undefined

  const originalData = transformJSON(data)

  const options = isObject(originalData) ? Object.assign({}, originalData?.options, { disposable: true }) : { disposable: true }

  target[key] = encode({ data: isObject(originalData) ? originalData.value : originalData, target, property, options })
}

export function isDisposable({
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
    const { disposable } = originalData.options

    if (disposable) {
      delete target[property]
      deleteProxyProperty(target, property)
    }
  }

  return {
    data,
    target,
    property,
  }
}
