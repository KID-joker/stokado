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

let lengthAltering = false
function createInstrumentations() {
  const instrumentations: Record<string, Function> = {};

  // instrument length-altering mutation methods to track length
  (['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach((key) => {
    instrumentations[key] = function (target: Array<any>) {
      return function (...args: any[]) {
        lengthAltering = true
        const oldLength: number = target.length
        const res = target[key].apply(target, args)
        if (target.length > oldLength)
          selfEmit(target, 'length', target.length, oldLength)

        lengthAltering = false
        return res
      }
    }
  })

  return instrumentations
}

const arrayInstrumentations: Record<string, Function> = createInstrumentations()
function get(
  target: object,
  property: string,
  receiver: any,
) {
  if (isArray(target) && hasOwn(arrayInstrumentations, property))
    return arrayInstrumentations[property](target)

  return Reflect.get(target, property, receiver)
}

function setStorageValue(
  target: object,
) {
  const { storage, storageProp } = proxyObjectMap.get(target)
  const encodeValue = encode({ data: target, target: storage, property: storageProp, options: getOptions(storage, storageProp) })
  storage.setItem(storageProp, encodeValue)
}

function set(
  target: Record<string, any>,
  key: string,
  value: any,
  receiver: object,
) {
  const arrayLengthFlag = isArray(target) && !lengthAltering
  const arrayLength: number | undefined = arrayLengthFlag ? target.length : undefined

  const oldValue = target[key]
  const hadKey = (isArray(target) && isIntegerKey(key)) ? Number(key) < target.length : hasOwn(target, key)

  const result = Reflect.set(target, key, value, receiver)
  if (result && hasChanged(value, oldValue)) {
    if (hadKey)
      selfEmit(target, key, value, oldValue)
    else
      selfEmit(target, key, value, undefined)

    // track `array[3] = 3` length
    if (arrayLength !== undefined && Number(key) >= arrayLength)
      selfEmit(target, 'length', target.length, arrayLength)

    setStorageValue(target)
  }

  return result
}

function has(
  target: object,
  property: string,
): boolean {
  const { storage, storageProp } = proxyObjectMap.get(target)
  const options = getOptions(storage, storageProp)
  // cancel disposable promise
  if (options.disposable)
    cancelDisposable()

  return Reflect.has(target, property)
}

function ownKeys(
  target: object,
): (string | symbol)[] {
  const { storage, storageProp } = proxyObjectMap.get(target)
  const options = getOptions(storage, storageProp)
  // cancel disposable promise
  if (options.disposable)
    cancelDisposable()

  return Reflect.ownKeys(target)
}

function deleteProperty(
  target: Record<string, any>,
  key: string,
) {
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
