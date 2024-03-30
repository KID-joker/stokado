import type { RawType, StorageOptions, TargetObject } from '@/types'
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
    read: (v: object, storage: Record<string, any>, property: string) => createProxyObject(v, storage, property),
    write: (v: object) => v,
  },
  Array: {
    read: (v: object, storage: Record<string, any>, property: string) => createProxyObject(v, storage, property),
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
  target,
  property,
}: {
  data: string | null
  target?: Record<string, any>
  property?: string
}): any {
  if (!isString(data))
    return data

  const nativeData: TargetObject | string = transformJSON(data)
  if (!isObject(nativeData))
    return nativeData

  const serializer = StorageSerializers[nativeData?.type as RawType]
  if (!serializer)
    return nativeData

  nativeData.value = ['Object', 'Array'].includes(nativeData.type) ? serializer.read(nativeData.value, target, property) : serializer.read(nativeData.value)

  if (target && property)
    setProxyStorageProperty(target, property, nativeData)

  return nativeData
}

export function encode({
  data,
  target,
  property,
  options,
}: {
  data: any
  target?: Record<string, any>
  property?: string
  options?: StorageOptions
}) {
  const rawType = getRawType(data)

  const serializer = StorageSerializers[rawType]
  if (!serializer)
    throw new Error(`can't set "${rawType}" property.`)

  const targetObject: TargetObject = {
    type: rawType,
    value: serializer.write(data),
    options,
  }

  if (target && property) {
    setProxyStorageProperty(target, property, {
      type: rawType,
      value: ['Object', 'Array'].includes(rawType) ? serializer.read(targetObject.value, target, property) : serializer.read(targetObject.value),
      options,
    })
  }

  return JSON.stringify(targetObject)
}
