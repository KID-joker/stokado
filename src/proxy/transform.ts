import type { RawType, StorageObject, StorageOptions } from '@/types'
import { createProxyObject } from '@/proxy/object'
import { setProxyStorageProperty } from '@/shared'
import { getRawType, isObject, isString, transformEval, transformJSON } from '@/utils'

interface Serializer<T> {
  read: (raw: any, storage?: Record<string, any>, property?: string) => T
  write: (value: T) => any
}

const identity = <T>(v: T): T => v
const toString = (v: any): string => String(v)

const StorageSerializers: Record<string, Serializer<any>> = {
  String: {
    read: identity,
    write: identity,
  },
  Number: {
    read: Number.parseFloat,
    write: toString,
  },
  BigInt: {
    read: BigInt,
    write: toString,
  },
  Boolean: {
    read: (v: string) => v === 'true',
    write: toString,
  },
  Null: {
    read: () => null,
    write: () => 'null',
  },
  Undefined: {
    read: () => undefined,
    write: () => 'undefined',
  },
  Object: {
    read: (v, storage, property) => createProxyObject(v, storage, property),
    write: identity,
  },
  Array: {
    read: (v, storage, property) => createProxyObject(v, storage, property),
    write: identity,
  },
  Set: {
    read: (v: any[]) => new Set(v),
    write: (v: Set<any>) => [...v],
  },
  Map: {
    read: (v: [any, any][]) => new Map(v),
    write: (v: Map<any, any>) => [...v],
  },
  Date: {
    read: (v: string) => new Date(v),
    write: toString,
  },
  URL: {
    read: (v: string) => new URL(v),
    write: toString,
  },
  RegExp: {
    read: (v: string) => transformEval(v),
    write: toString,
  },
  Function: {
    read: (v: string) => transformEval(`(function() { return ${v} })()`),
    write: toString,
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
  const nativeData: { type: string, value: string | object } = transformJSON(data) as { type: string, value: string | object }
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
