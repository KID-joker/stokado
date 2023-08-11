import { getExpires, isExpired, removeExpires, setExpires } from '@/extends/expires'
import { activeEffect, clearProxy, deleteProxyProperty, prefixInst, proxyMap, shouldTrackInst } from '@/shared'
import { compose, hasChanged, hasOwn, isArray, isObject, isString, propertyIsInPrototype, transformJSON } from '@/utils'
import { emit, off, on, once } from '@/extends/watch'
import type { StorageLike } from '@/types'
import { decode, encode } from '@/proxy/transform'
import { isDisposable, setDisposable } from '@/extends/disposable'

function baseSetter(
  target: Record<string, any>,
  property: string,
  value: any,
  ...args: any[]
) {
  const receiver = args.at(-1)
  const key = `${prefixInst.getPrefix()}${property}`
  const oldValue = compose(decode, isExpired)({ data: target[key], target, property })
  const encodeValue = encode({ data: value, target, property, options: Object.assign({}, receiver.getOptions(property), args.at(-2)) })
  const result = Reflect.set(target, key, encodeValue, receiver)
  if (result && hasChanged(value, oldValue) && shouldTrackInst.getTracking())
    emit(target, property, value, oldValue)

  if (isArray(value) && isArray(oldValue) && hasChanged(value.length, oldValue.length))
    emit(target, `${property}.length`, value.length, oldValue.length)

  return result
}

function createInstrumentations(
  target: Record<string, any>,
  receiver: any,
) {
  const instrumentations: Record<string, Function> = {}

  instrumentations.clear = function () {
    clearProxy(target)
    target.clear.apply(target)
  }
  instrumentations.key = function (...args: unknown[]) {
    const property = target.key.apply(target!, args)
    return property.slice(prefixInst.getPrefix().length)
  }

  const methods: Record<string, Function> = {
    removeItem: deleteProperty,
    getExpires,
    off,
    on,
    once,
    getOptions,
    removeExpires,
    setDisposable,
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
  if (shouldTrackInst.getTracking()) {
    activeEffect.storage = target
    activeEffect.key = property
    activeEffect.proxy = receiver
    activeEffect.options = getOptions(target, property)
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

  if (property === 'length')
    return target.length

  const key = `${prefixInst.getPrefix()}${property}`
  const value = target[key]
  if (!value)
    return undefined

  return compose(decode, isExpired, isDisposable)({ data: value, target, property })
}

function set(
  target: Record<string, any>,
  property: string,
  value: any,
  receiver: any,
) {
  return baseSetter(target, property, value, receiver)
}

// only prefixed properties are accepted in the instance
function has(
  target: object,
  property: string,
): boolean {
  return hasOwn(target, `${prefixInst.getPrefix()}${property}`) || propertyIsInPrototype(target, property)
}

function ownKeys(
  target: object,
): (string | symbol)[] {
  const result = Reflect.ownKeys(target)
  return result.map(key => isString(key) ? key.slice(prefixInst.getPrefix().length) : key)
}

function deleteProperty(
  target: Record<string, any>,
  property: string,
) {
  const key = `${prefixInst.getPrefix()}${property}`
  const hadKey = hasOwn(target, key)
  const oldValue = compose(decode, isExpired)({ data: target[key], target, property })
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    hasChanged(undefined, oldValue) && emit(target, property, undefined, oldValue)
    deleteProxyProperty(target, property)
  }

  return result
}

function setItem(
  target: Record<string, any>,
  property: string,
  value: any,
  ...args: any[]
) {
  return baseSetter(target, property, value, ...args)
}

function getOptions(
  target: Record<string, any>,
  property: string,
) {
  const key = `${prefixInst.getPrefix()}${property}`
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
    ownKeys,
    deleteProperty,
  })

  proxyMap.set(storage, {})

  return proxy
}
