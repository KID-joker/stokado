import type { RawType, StorageOptions, TargetObject } from '@/types'
import { getRawType, isObject, transformEval, transformJSON } from '@/utils'
import { createProxyObject } from '@/proxy/object'

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
  RegExp: {
    read: (v: string) => transformEval(v),
    write: (v: RegExp) => String(v),
  },
  Function: {
    read: (v: string) => transformEval(`(function() { return ${v} })()`),
    write: (v: Function) => String(v),
  },
}

export function decode(
  data: string,
  deleteFunc?: Function,
): any {
  let originalData: string | TargetObject = data
  try {
    originalData = transformJSON(data)
  }
  catch (e) {}

  if (!isObject(originalData))
    return originalData

  if (originalData.options) {
    const { disposable, expires } = originalData.options

    if (expires && new Date(+expires).getTime() <= Date.now() && deleteFunc) {
      deleteFunc()
      return undefined
    }

    if (disposable && deleteFunc) {
      // remove after returning data
      deleteFunc()
    }
  }

  const serializer = StorageSerializers[originalData.type as RawType]
  if (!serializer)
    return originalData.value

  return serializer.read(originalData.value)
}

export function encode(
  data: any,
  options?: StorageOptions,
) {
  const rawType = getRawType(data)

  const serializer = StorageSerializers[rawType]
  if (!serializer)
    throw new Error(`can't set "${rawType}" property.`)

  const targetObject: TargetObject = {
    type: rawType,
    value: serializer.write(data),
    options,
  }

  return JSON.stringify(targetObject)
}
