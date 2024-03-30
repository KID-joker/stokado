import { getOptions } from './options'
import { encode } from '@/proxy/transform'
import { deleteProxyStorageProperty, getProxyStorageProperty } from '@/shared'
import type { ExpiresType, StorageObject } from '@/types'
import { formatTime, isObject, pThen } from '@/utils'

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

  const data = getProxyStorageProperty(storage, property)

  pThen(data, (res: StorageObject | string | null) => {
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
  const options = getOptions(storage, property)

  if (!options?.expires || +options.expires <= Date.now())
    return undefined

  return new Date(+options.expires)
}

export function removeExpires(
  storage: Record<string, any>,
  property: string,
) {
  const data = getProxyStorageProperty(storage, property)

  pThen(data, (res: StorageObject | string | null) => {
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
