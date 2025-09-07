import type { ExpiresType, StorageObject, StorageOptions } from '@/types'
import { encode } from '@/proxy/transform'
import { deleteProxyStorageProperty, getProxyStorageProperty } from '@/shared'
import { formatTime, isObject, pThen } from '@/utils'
import { getOptions } from './options'

export function setExpires(
  storage: Record<string, any>,
  property: string,
  expires: ExpiresType,
) {
  const time = formatTime(expires)

  if (time <= Date.now()) {
    deleteProxyStorageProperty(storage, property)
    return undefined
  }

  pThen(() => getProxyStorageProperty(storage, property), (res: StorageObject | string | null) => {
    if (isObject(res)) {
      const options = Object.assign({}, res?.options, { expires: time })
      const encodeValue = encode({ data: res.value, storage, property, options })
      storage.setItem(property, encodeValue)
    }
  })
}

export function getExpires(
  storage: Record<string, any>,
  property: string,
) {
  return pThen(() => getOptions(storage, property), (res: StorageOptions) => {
    if (!res?.expires || +res.expires <= Date.now())
      return undefined

    return new Date(+res.expires)
  })
}

export function removeExpires(
  storage: Record<string, any>,
  property: string,
) {
  pThen(() => getProxyStorageProperty(storage, property), (res: StorageObject | string | null) => {
    if (isObject(res) && res.options) {
      delete res.options.expires
      const encodeValue = encode({ data: res.value, storage, property, options: res.options })
      storage.setItem(property, encodeValue)
    }
  })
}

export function checkExpired({
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

  const { expires } = data.options

  if (expires && new Date(+expires).getTime() <= Date.now()) {
    deleteProxyStorageProperty(storage, property)
    data.value = undefined
  }

  return data
}
