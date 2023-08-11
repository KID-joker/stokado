import type { RawType, StorageOptions, TargetObject } from '@/types'
import { getRawType, isObject, isString, transformEval, transformJSON } from '@/utils'
import { createProxyObject } from '@/proxy/object'
import { proxyMap } from '@/shared'

interface Serializer<T> {
  read(raw: string | object): T
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
    read: (v: object) => createProxyObject(v),
    write: (v: object) => v,
  },
  Array: {
    read: (v: object) => createProxyObject(v),
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
  data: string
  target?: Record<string, any>
  property?: string
}): any {
  if (!isString(data))
    return data

  const targetProxy: Record<string, any> | undefined = target && proxyMap.get(target)
  const targetData: TargetObject | undefined = targetProxy && targetProxy[property!]
  if (targetData)
    return targetData.value

  const originalData: TargetObject | string = transformJSON(data)

  if (!isObject(originalData))
    return originalData

  const serializer = StorageSerializers[originalData.type as RawType]
  if (!serializer)
    return originalData.value

  const value = serializer.read(originalData.value)

  if (targetProxy && property) {
    targetProxy![property] = {
      ...originalData,
      value,
    }
  }

  return value
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
    const targetProxy: Record<string, any> | undefined = proxyMap.get(target)
    targetProxy![property] = {
      ...targetObject,
      value: serializer.read(targetObject.value),
    }
  }

  return JSON.stringify(targetObject)
}
