import { encode } from '@/proxy/transform'
import { deleteProxyStorageProperty, getProxyStorageProperty } from '@/shared'
import type { TargetObject } from '@/types'
import { isObject, pThen } from '@/utils'

let cancelId: number | undefined

export function setDisposable(
  target: Record<string, any>,
  property: string,
) {
  const data = getProxyStorageProperty(target, property)

  pThen(data, (res: TargetObject | string | null) => {
    if (isObject(res)) {
      const options = Object.assign({}, res?.options, { disposable: true })
      const encodeValue = encode({ data: res.value, target, property, options })
      target.setItem(property, encodeValue)
    }
  })
}

export function checkDisposable({
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

  const { disposable } = data.options

  if (disposable) {
    cancelId = window.setTimeout(() => {
      deleteProxyStorageProperty(target, property)
    }, 0)
  }

  return data
}

export function cancelDisposable() {
  clearTimeout(cancelId)
}
