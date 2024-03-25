import PCancelable from 'p-cancelable'
import { encode } from '@/proxy/transform'
import { deleteProxyProperty, getProxyProperty } from '@/shared'
import type { TargetObject } from '@/types'
import { isObject, pThen } from '@/utils'

let cancelablePromise: PCancelable<void>

export function setDisposable(
  target: Record<string, any>,
  property: string,
) {
  const data = getProxyProperty(target, property)

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
    cancelablePromise = new PCancelable((resolve, reject, onCancel) => {
      onCancel.shouldReject = false

      deleteProxyProperty(target, property)
      data.value = undefined

      resolve()
    })
  }

  return data
}

export function cancelDisposable() {
  cancelablePromise?.cancel()
}
