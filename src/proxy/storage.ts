import { getExpires, removeExpires, setExpires } from '@/extends/expires'
import { activeEffect, deleteFunc, getPrefix, getShouldTrack, proxyMap } from '@/shared'
import { hasChanged, hasOwn, isObject, propertyIsInPrototype, transformJSON } from '@/utils'
import { emit, off, on, once } from '@/extends/watch'
import type { StorageLike } from '@/types'
import { decode, encode } from '@/proxy/transform'
import { setDisposable } from '@/extends/disposable'

function baseSetter(
  target: Record<string, any>,
  property: string,
  value: any,
  encodeValue: string,
  receiver: any,
) {
  const key = `${getPrefix()}${property}`
  const decodeOldValue = decode(target[key], deleteFunc(target, key))
  const oldValue = proxyMap.get(decodeOldValue) || decodeOldValue
  const result = Reflect.set(target, key, encodeValue, receiver)
  if (result && hasChanged(value, oldValue) && getShouldTrack())
    emit(target, property, value, oldValue)

  return result
}

function createInstrumentations(
  target: Record<string, any>,
  receiver: any,
) {
  const instrumentations: Record<string, Function> = {};

  (['clear', 'key'] as const).forEach((key) => {
    instrumentations[key] = target[key].bind(target)
  })

  const methods: Record<string, Function> = {
    removeItem: deleteProperty,
    getExpires,
    off,
    on,
    once,
    getOptions,
  }
  Object.keys(methods).forEach((key) => {
    instrumentations[key] = function (...args: unknown[]) {
      return methods[key](target, ...args)
    }
  })

  const specialMethods: Record<string, Function> = {
    getItem: get,
    setItem,
    setExpires,
    removeExpires,
    setDisposable,
  }
  Object.keys(specialMethods).forEach((key) => {
    instrumentations[key] = function (...args: unknown[]) {
      return specialMethods[key](target, ...args, receiver)
    }
  })

  return instrumentations
}

const storageInstrumentations: Map<object, Record<string, Function>> = new Map()
function get(
  target: Record<string, any>,
  property: string,
  receiver: any,
) {
  // records the parent of array and object
  if (getShouldTrack()) {
    activeEffect.storage = target
    activeEffect.key = property
    activeEffect.proxy = receiver
  }

  let instrumentations = storageInstrumentations.get(target)
  if (!instrumentations) {
    instrumentations = createInstrumentations(target, receiver)
    storageInstrumentations.set(target, instrumentations)
  }
  if (hasOwn(instrumentations, property))
    return Reflect.get(instrumentations, property, receiver)

  if (!has(target, property))
    return undefined

  const key = `${getPrefix()}${property}`
  const value = target[key] || target[property]
  if (!value)
    return value

  return decode(value, deleteFunc(target, key))
}

function set(
  target: Record<string, any>,
  property: string,
  value: any,
  receiver: any,
) {
  return baseSetter(target, property, value, encode(value), receiver)
}

// only prefixed properties are accepted in the instance
function has(
  target: object,
  property: string,
): boolean {
  return hasOwn(target, `${getPrefix()}${property}`) || propertyIsInPrototype(target, property)
}

function deleteProperty(
  target: Record<string, any>,
  property: string,
) {
  const key = `${getPrefix()}${property}`
  const hadKey = hasOwn(target, key)
  const decodeOldValue = decode(target[key], deleteFunc(target, key))
  const oldValue = proxyMap.get(decodeOldValue) || decodeOldValue
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey)
    emit(target, property, undefined, oldValue)

  return result
}

function setItem(
  target: Record<string, any>,
  property: string,
  value: any,
  ...args: any[]
) {
  return baseSetter(target, property, value, encode(value, args.at(-2)), args.at(-1))
}

function getOptions(
  target: Record<string, any>,
  property: string,
) {
  const key = `${getPrefix()}${property}`
  const value = transformJSON(target[key])

  if (!isObject(value))
    return {}

  return value.options || {}
}

export function createProxyStorage(storage: StorageLike) {
  if (!storage)
    return null

  const proxy = new Proxy(storage, {
    get,
    set,
    has,
    deleteProperty,
  })

  return proxy
}
