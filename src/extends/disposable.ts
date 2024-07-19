import { getProxyStorageProperty, setProxyStorageProperty } from '@/shared'
import type { StorageLike, StorageObject } from '@/types'
import { isObject } from '@/utils'

let cancelId: number | undefined

export function setDisposable(
  storage: StorageLike,
  property: string,
) {
  return getProxyStorageProperty(storage, property).then((res: StorageObject | string | null) => {
    if (isObject(res)) {
      const options = Object.assign({}, res?.options, { disposable: true })
      setProxyStorageProperty(storage, property, res.value, options)
    }
    return true
  })
}

export function checkDisposable(
  data: StorageObject | string | null,
  clear: Function,
) {
  if (!isObject(data) || !data.options)
    return data

  const { disposable } = data.options

  if (disposable) {
    cancelId = window.setTimeout(() => {
      clear()
    }, 0)
  }

  return data
}

export function cancelDisposable() {
  clearTimeout(cancelId)
}
