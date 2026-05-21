import type { StorageObject } from '@/types'
import { deleteProxyStorageProperty } from '@/cache'
import { isObject } from '@/utils'

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
