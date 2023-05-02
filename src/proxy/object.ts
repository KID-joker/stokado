import { activeEffect, enableTracking, pauseTracking, proxyMap } from '@/shared'
import { hasChanged, hasOwn, isArray, isIntegerKey } from '@/utils'
import { emit } from '@/extends/watch'

function selfEmit(
  obj: object,
  key: string,
  ...args: any[]
) {
  let actualKey = `${activeEffect.key}.${key}`
  if (isArray(obj) && isIntegerKey(key))
    actualKey = `${activeEffect.key}[${key}]`

  emit(activeEffect.storage, actualKey, ...args)
}

let lengthAltering = false
function createInstrumentations() {
  const instrumentations: Record<string, Function> = {};

  // instrument length-altering mutation methods to track length
  (['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      lengthAltering = true
      const oldLength: number = this.length
      const res = (proxyMap.get(this) as any)[key].apply(this, args)
      if (this.length > oldLength)
        selfEmit(this, 'length', this.length, oldLength)

      lengthAltering = false
      return res
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
    return Reflect.get(arrayInstrumentations, property, receiver)

  return Reflect.get(target, property, receiver)
}

function setStorageValue(
  value: object,
) {
  pauseTracking()
  const date = activeEffect.proxy.getExpires(activeEffect.key)
  if (date)
    activeEffect.proxy.setExpires(activeEffect.key, value, date)
  else
    activeEffect.proxy[activeEffect.key] = value

  enableTracking()
}

function set(
  target: Record<string, any>,
  key: string,
  value: unknown,
  receiver: object,
) {
  let arrayLength: number | undefined
  if (isArray(target) && !lengthAltering)
    arrayLength = target.length

  const oldValue = target[key]
  const hadKey = (isArray(target) && isIntegerKey(key)) ? Number(key) < target.length : hasOwn(target, key)

  const result = Reflect.set(target, key, value, receiver)
  if (result && hasChanged(value, oldValue)) {
    if (hadKey)
      selfEmit(target, key, value, oldValue)
    else
      selfEmit(target, key, value, undefined)

    // track `array[3] = 3` length
    if (isArray(target) && arrayLength !== undefined && Number(key) >= arrayLength)
      selfEmit(target, 'length', target.length, arrayLength)

    setStorageValue(target)
  }

  return result
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
) {
  const proxy = new Proxy(target, {
    get,
    set,
    deleteProperty,
  })

  proxyMap.set(proxy, target)
  return proxy
}
