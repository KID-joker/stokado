import type { RawType } from '@/types'

export function isMap(val: unknown): val is Map<any, any> {
  return getTypeString(val) === '[object Map]'
}

export function isDate(val: unknown): val is Date {
  return getTypeString(val) === '[object Date]'
}

export function isFunction(val: unknown): val is Function {
  return typeof val === 'function'
}

export function isNumber(val: unknown): val is number {
  return typeof val === 'number'
}

export function isString(val: unknown): val is string {
  return typeof val === 'string'
}

export function isObject(val: unknown): val is Record<any, any> {
  return val !== null && typeof val === 'object'
}

export function isPromise<T = any>(val: unknown): val is Promise<T> {
  return (
    (isObject(val) || isFunction(val))
    && isFunction((val as any).then)
    && isFunction((val as any).catch)
  )
}

export function isIntegerKey(key: unknown) {
  return typeof key === 'string'
    && key !== 'NaN'
    && key[0] !== '-'
    && `${Number.parseInt(key, 10)}` === key
}

export function getTypeString(value: unknown): string {
  return Object.prototype.toString.call(value)
}

export function getRawType(value: unknown): RawType {
  return getTypeString(value).slice(8, -1) as RawType
}

export function hasChanged(value: any, oldValue: any): boolean {
  return !Object.is(value, oldValue)
}

const hasOwnProperty = Object.prototype.hasOwnProperty
export function hasOwn(val: object, key: string | symbol): key is keyof typeof val {
  return hasOwnProperty.call(val, key)
}

export function formatTime(time: any): number {
  if (isDate(time))
    return time.getTime()

  if (isString(time))
    return +time.padEnd(13, '0')

  return time
}

export function resolve<T, R>(val: T | Promise<T>, fn: (v: T) => R | Promise<R>): R | Promise<R> {
  if (isPromise(val)) return (val as Promise<T>).then(fn)
  return fn(val as T)
}
