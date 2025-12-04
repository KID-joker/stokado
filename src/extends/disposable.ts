import type { StorageObject } from '@/types'
import { encode } from '@/proxy/transform'
import { deleteProxyStorageProperty, getProxyStorageProperty } from '@/shared'
import { isObject, pThen } from '@/utils'

export function setDisposable(
  storage: Record<string, any>,
  property: string,
) {
  pThen(() => getProxyStorageProperty(storage, property), (res: StorageObject | string | null) => {
    if (isObject(res)) {
      const options = Object.assign({}, res?.options, { disposable: true })
      const encodeValue = encode({ data: res.value, storage, property, options })
      storage.setItem(property, encodeValue)
    }
  })
}

export function checkDisposable({
  data,
  storage,
  property,
}: {
  data: StorageObject | string | null
  storage: Record<string, any>
  property: string
}) {
  if (!isObject(data) || !data.options)
    return data

  const { disposable } = data.options

  if (disposable) {
    deleteProxyStorageProperty(storage, property)
  }

  return data
}
