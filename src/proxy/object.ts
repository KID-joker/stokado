import { encode } from './transform'
import { hasChanged, hasOwn, isArray, isIntegerKey } from '@/utils'
import { emit } from '@/extends/watch'
import { cancelDisposable } from '@/extends/disposable'
import { getOptions } from '@/extends/options'

const proxyObjectMap = new WeakMap()

function selfEmit(
  target: object,
  key: string,
  value: any,
  oldValue: any,
) {
  const { storage, storageProp } = proxyObjectMap.get(target)
  const isIntKey = isArray(target) && isIntegerKey(key)
  const actualKey = isIntKey ? `${storageProp}[${key}]` : `${storageProp}.${key}`

  emit(storage, actualKey, value, oldValue)
}

function selfCancel(target: object) {
  const { storage, storageProp } = proxyObjectMap.get(target)
  const options = getOptions(storage, storageProp)
  // cancel disposable promise
  if (options.disposable)
    cancelDisposable()
}

function setStorageValue(target: object) {
  const { storage, storageProp } = proxyObjectMap.get(target)
  const encodeValue = encode({ data: target, target: storage, property: storageProp, options: getOptions(storage, storageProp) })
  storage.setItem(storageProp, encodeValue)
}

let calling = false
function createInstrumentations() {
  const instrumentations: Record<string, Function> = {};

  // instrument length-altering mutation methods to track length
  (['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach((key) => {
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
  key: string,
  receiver: any,
) {
  selfCancel(target)

  if (isArray(target) && hasOwn(arrayInstrumentations, key))
    return arrayInstrumentations[key](target)

  return Reflect.get(target, key, receiver)
}

// Distinguish between array[0] = 0 and array.push(0)
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
  if (result && hasChanged(value, oldValue)) {
    if (hadKey)
      selfEmit(target, key, value, oldValue)
    else
      selfEmit(target, key, value, undefined)

    // track `array[3] = 3` length
    if (key !== 'length' && !calling && arrayLength !== undefined && target.length !== arrayLength)
      selfEmit(target, 'length', target.length, arrayLength)

    setStorageValue(target)
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
  storage: Record<string, any>,
  property: string,
) {
  const proxy = new Proxy(target, {
    get,
    set,
    has,
    ownKeys,
    deleteProperty,
  })

  proxyObjectMap.set(target, {
    storage,
    storageProp: property,
  })

  return proxy
}
