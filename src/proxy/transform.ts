import type { RawType, StorageObject, StorageOptions } from '@/types'
import { getRawType, isObject, isString, transformEval, transformJSON } from '@/utils'
import { createProxyObject } from '@/proxy/object'
import { setProxyStorageProperty } from '@/shared'

interface Serializer<T> {
  read(raw: string | object, storage?: Record<string, any>, property?: string): T
  write(value: T): string | object
}
const StorageSerializers: Record<RawType, Serializer<any>> = {
  String: {
    read: (v: string) => v,
    write: (v: string) => v,
  },
  Number: {
    read: (v: string) => Number.parseFloat(v),
    write: (v: number) => String(v),
  },
  BigInt: {
    read: (v: string) => BigInt(v),
    write: (v: bigint) => String(v),
  },
  Boolean: {
    read: (v: string) => v === 'true',
    write: (v: boolean) => String(v),
  },
  Null: {
    read: () => null,
    write: (v: null) => String(v),
  },
  Undefined: {
    read: () => undefined,
    write: (v: undefined) => String(v),
  },
  Object: {
    read: (v: object, storage?: Record<string, any>, property?: string) => createProxyObject(v, storage, property),
    write: (v: object) => v,
  },
  Array: {
    read: (v: object, storage?: Record<string, any>, property?: string) => createProxyObject(v, storage, property),
    write: (v: object) => v,
  },
  Set: {
    read: (v: Array<any>) => new Set(v),
    write: (v: Set<any>) => Array.from(v),
  },
  Map: {
    read: (v: Array<[any, any]>) => new Map(v),
    write: (v: Map<any, any>) => Array.from(v),
  },
  Date: {
    read: (v: string) => new Date(v),
    write: (v: Date) => String(v),
  },
  URL: {
    read: (v: string) => new URL(v),
    write: (v: URL) => String(v),
  },
  RegExp: {
    read: (v: string) => transformEval(v),
    write: (v: RegExp) => String(v),
  },
  Function: {
    read: (v: string) => transformEval(`(function() { return ${v} })()`),
    write: (v: Function) => String(v),
  },
}

export function decode({
  data,
  storage,
  property,
}: {
  data: string | null
  storage?: Record<string, any>
  property?: string
}): any {
  if (!isString(data))
    return data

  const nativeData: object | string = transformJSON(data)
  if (!isObject(nativeData))
    return nativeData

  const serializer = StorageSerializers[nativeData?.type as RawType]
  if (!serializer)
    return nativeData

  nativeData.value = ['Object', 'Array'].includes(nativeData.type) ? serializer.read(nativeData.value, storage, property) : serializer.read(nativeData.value)

  if (storage && property)
    setProxyStorageProperty(storage, property, nativeData as StorageObject)

  return nativeData
}

export function encode({
  data,
  storage,
  property,
  options,
}: {
  data: any
  storage?: Record<string, any>
  property?: string
  options?: StorageOptions
}) {
  const rawType = getRawType(data)

  const serializer = StorageSerializers[rawType]
  if (!serializer)
    throw new Error(`can't set "${rawType}" property.`)

  const storageObject: StorageObject = {
    type: rawType,
    value: serializer.write(data),
    options,
  }

  if (storage && property) {
    setProxyStorageProperty(storage, property, {
      type: rawType,
      value: ['Object', 'Array'].includes(rawType) ? serializer.read(storageObject.value, storage, property) : serializer.read(storageObject.value),
      options,
    })
  }

  return JSON.stringify(storageObject)
}

export function simpleDecode(data: string) {
  const nativeData: { type: string; value: string | object } = transformJSON(data) as { type: string; value: string | object }
  const serializer = StorageSerializers[nativeData.type as RawType]

  return serializer.read(nativeData.value)
}

export function simpleEncode(data: any) {
  const rawType = getRawType(data)
  const serializer = StorageSerializers[rawType]

  return JSON.stringify({
    type: rawType,
    value: serializer.write(data),
  })
}
