import ThenRef from 'then-ref'
import { hasChanged, hasOwn, isArray, isIntegerKey } from '@/utils'
import { emit } from '@/extends/watch'
import { cancelDisposable } from '@/extends/disposable'
import { getOptions } from '@/extends/options'
import { setProxyStorageProperty, setRaw } from '@/shared'
import type { ProxyObject, StorageOptions } from '@/types'

function selfEmit(
  target: object,
  key: string,
  value: any,
  oldValue: any,
) {
  const { storage, property } = target as ProxyObject
  const isIntKey = isArray(target) && isIntegerKey(key)
  const actualKey = isIntKey ? `${property}[${key}]` : `${property}.${key}`

  emit(storage, actualKey, value, oldValue, key !== 'length' ? property : undefined)
}

function selfCancel(target: object) {
  const { storage, property } = target as ProxyObject
  ThenRef(getOptions)(storage, property).then((options: StorageOptions) => {
    // cancel disposable promise
    if (options.disposable)
      cancelDisposable()
  })
}

function setStorageValue(target: object) {
  const { storage, property } = target as ProxyObject
  ThenRef(getOptions)(storage, property).then((options: StorageOptions) => {
    setProxyStorageProperty(storage, property, target, options)
  })
}

let calling = false
function createInstrumentations() {
  const instrumentations: Record<string, Function> = {};

  // instrument length-altering mutation methods to track length
  (['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach((key: any) => {
    instrumentations[key] = function (target: Array<any>) {
      return function (...args: any[]) {
        calling = true

        const oldLength: number = target.length
        const res = target[key].apply(target, args)
        setStorageValue(target)
        if (target.length !== oldLength)
          selfEmit(target, 'length', target.length, oldLength)

        calling = false
        return res
      }
    }
  })

  return instrumentations
}

const arrayInstrumentations: Record<string, Function> = createInstrumentations()
function get(
  target: object,
  key: string | symbol,
  receiver: any,
) {
  // Object.prototype.toString.call
  if (key !== Symbol.toStringTag)
    selfCancel(target)

  if (isArray(target) && hasOwn(arrayInstrumentations, key))
    return arrayInstrumentations[key](target)

  return Reflect.get(target, key, receiver)
}

/**
 * array = [];
 * array[0] = 0;
 * array.push(1);
 * array.length = 3;
 */
function set(
  target: Record<string, any>,
  key: string,
  value: any,
  receiver: object,
) {
  selfCancel(target)

  const arrayLength: number | undefined = isArray(target) ? target.length : undefined

  const oldValue = target[key]
  const hadKey = (isArray(target) && isIntegerKey(key)) ? Number(key) < target.length : hasOwn(target, key)

  const result = Reflect.set(target, key, value, receiver)
  if (result) {
    if (hasChanged(value, oldValue)) {
      // track `array.length = 3` length
      if (hadKey)
        selfEmit(target, key, value, oldValue)
      else
        selfEmit(target, key, value, undefined)
    }

    if (!calling) {
      // track `array[0] = 0` length
      if (key !== 'length' && arrayLength !== undefined && target.length !== arrayLength)
        selfEmit(target, 'length', target.length, arrayLength)

      setStorageValue(target)
    }
  }

  return result
}

function has(
  target: object,
  key: string,
): boolean {
  selfCancel(target)

  return Reflect.has(target, key)
}

function ownKeys(
  target: object,
): (string | symbol)[] {
  selfCancel(target)

  return Reflect.ownKeys(target)
}

function deleteProperty(
  target: Record<string, any>,
  key: string,
) {
  selfCancel(target)

  const hadKey = hasOwn(target, key)
  const oldValue = target[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    selfEmit(target, key, undefined, oldValue)

    setStorageValue(target)
  }
  return result
}

export function createProxyObject(
  target: object,
) {
  const proxy = new Proxy(target, {
    get,
    set,
    has,
    ownKeys,
    deleteProperty,
  })

  setRaw(proxy, target)

  return proxy
}
