import type { RawType, TargetObject } from '@/types'

export const isArray = Array.isArray
export function isSet(val: unknown): val is Set<any> {
  return getTypeString(val) === '[object Set]'
}
export function isMap(val: unknown): val is Map<any, any> {
  return getTypeString(val) === '[object Map]'
}

export function isDate(val: unknown): val is Date {
  return getTypeString(val) === '[object Date]'
}
export function isRegExp(val: unknown): val is RegExp {
  return getTypeString(val) === '[object RegExp]'
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

export function isIntegerKey(key: unknown) {
  return typeof key === 'string'
  && key !== 'NaN'
  && key[0] !== '-'
  && `${parseInt(key, 10)}` === key
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

export function transformJSON(
  data: string,
): TargetObject | string {
  try {
    return JSON.parse(data)
  }
  catch (e) {
    return data
  }
}

// prototies exist in the prototype chain
export function propertyIsInPrototype(object: object, prototypeName: string) {
  return !hasOwn(object, prototypeName) && (prototypeName in object)
}

const hasOwnProperty = Object.prototype.hasOwnProperty
export function hasOwn(val: object,
  key: string | symbol): key is keyof typeof val {
  return hasOwnProperty.call(val, key)
}

export function transformEval(code: string) {
  // runs in the global scope rather than the local one
  const eval2 = eval
  return (function () {
    return eval2(code)
  })()
}

export function formatTime(time: any) {
  if (isDate(time))
    return time.getTime()

  if (isString(time))
    return +time.padEnd(13, '0')

  return time
}
