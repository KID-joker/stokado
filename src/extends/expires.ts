import ThenRef from 'then-ref'
import { getOptions } from './options'
import { deleteProxyStorageProperty, getProxyStorageProperty, setProxyStorageProperty } from '@/shared'
import type { ExpiresType, StorageLike, StorageObject, StorageOptions } from '@/types'
import { formatTime, isObject } from '@/utils'

export function setExpires(
  storage: StorageLike,
  property: string,
  expires: ExpiresType,
) {
  const time = formatTime(expires)

  if (time <= Date.now()) {
    deleteProxyStorageProperty(storage, property)
    return undefined
  }

  return getProxyStorageProperty(storage, property).then((res: StorageObject | string | null) => {
    if (isObject(res)) {
      const options = Object.assign({}, res?.options, { expires: time })
      setProxyStorageProperty(storage, property, res.value, options)
    }
    return time
  })
}

export function getExpires(
  storage: StorageLike,
  property: string,
) {
  return ThenRef(getOptions)(storage, property).then((res: StorageOptions) => {
    if (!res?.expires || +res.expires <= Date.now())
      return undefined

    return new Date(+res.expires)
  }).value
}

export function removeExpires(
  storage: StorageLike,
  property: string,
) {
  return getProxyStorageProperty(storage, property).then((res: StorageObject | string | null) => {
    if (isObject(res) && res.options) {
      delete res.options.expires
      setProxyStorageProperty(storage, property, res.value, res.options)
    }
    return true
  })
}

export function checkExpired(
  data: StorageObject | string | null,
  storage: StorageLike,
  property: string,
) {
  if (!isObject(data) || !data.options)
    return data

  const { expires } = data.options

  if (expires && new Date(+expires).getTime() <= Date.now()) {
    deleteProxyStorageProperty(storage, property)
    data.value = undefined
  }

  return data
}
