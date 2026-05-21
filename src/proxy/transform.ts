import type { RawType, StorageObject, StorageOptions } from '@/types'
import { getRawType, isObject, isString, transformEval, transformJSON } from '@/utils'

interface Serializer<T> {
  read: (raw: any, storage?: Record<string, any>, property?: string) => T
  write: (value: T) => any
}

const identity = <T>(v: T): T => v
const toString = (v: any): string => String(v)

let createProxyObject: (v: any, storage?: Record<string, any>, property?: string) => any = (v: any) => v

// Register the object creator function to avoid circular dependency with object.ts
export function registerObjectCreator(creator: typeof createProxyObject) {
  createProxyObject = creator
}

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

/**
 * Decode storage string to raw value or proxy object
 * @param data - The string or null from storage
 * @param storage - The storage instance
 * @param property - The property name
 */
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

  // Add comments for complex logic
  // Here we determine if the data needs to be proxied (Object/Array) or just returned as is
  nativeData.value = ['Object', 'Array'].includes(nativeData.type) ? serializer.read(nativeData.value, storage, property) : serializer.read(nativeData.value)

  return nativeData
}

/**
 * Encode value to storage string format
 * @param data - The raw value
 * @param options - Storage options
 */
export function encode({
  data,
  options,
}: {
  data: any
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

  return JSON.stringify(storageObject)
}
