import { getExpires, removeExpires, setExpires } from '@/extends/expires'
import { clearProxy, deleteProxyProperty, getProxyProperty, setProxy } from '@/shared'
import { hasOwn, isArray, isObject, isStorage, isString, pThen } from '@/utils'
import { emit, off, on, once } from '@/extends/watch'
import type { StorageLike, StorageOptions, TargetObject } from '@/types'
import { encode } from '@/proxy/transform'
import { checkDisposable, setDisposable } from '@/extends/disposable'
import { getOptions } from '@/extends/options'

function clear(target: Record<string, any>) {
  return function () {
    clearProxy(target)
  }
}

function getItem(target: Record<string, any>) {
  return function (key: string) {
    const data = getProxyProperty(target, key)
    return pThen(data, (res: TargetObject | string | null) => {
      const returnData = checkDisposable({ data: res, target, property: key })
      return isObject(returnData) ? returnData.value : returnData
    })
  }
}

function setItem(
  target: Record<string, any>,
  property: string,
  value: any,
  options?: StorageOptions,
) {
  const oldData = getProxyProperty(target, property)

  const encodeValue = encode({ data: value, target, property, options: Object.assign({}, getOptions(target, property), options) })
  target.setItem(property, encodeValue)

  pThen(oldData, (res: TargetObject | string | null) => {
    const oldValue = isObject(res) ? res.value : (res || undefined)

    emit(target, property, value, oldValue)

    if (isArray(value) && isArray(oldValue))
      emit(target, `${property}.length`, value.length, oldValue.length)
  })

  return true
}

function removeItem(target: Record<string, any>) {
  return function (key: string) {
    deleteProxyProperty(target, key)
  }
}

const instrumentations: Record<string, Function> = createInstrumentations()
function createInstrumentations() {
  const nativeMethods: Record<string, Function> = {
    clear,
    getItem,
    setItem,
    removeItem,
  }

  const methods: Record<string, Function> = Object.assign({}, nativeMethods)

  const extendMethods: Record<string, Function> = {
    getExpires,
    getOptions,
    off,
    on,
    once,
    removeExpires,
    setDisposable,
    setExpires,
  }
  for (const methodName in extendMethods) {
    methods[methodName] = function (target: Record<string, any>) {
      return function (...args: any[]) {
        return extendMethods[methodName](target, ...args)
      }
    }
  }

  return methods
}

function get(
  target: Record<string, any>,
  property: string,
) {
  if (hasOwn(instrumentations, property))
    return instrumentations[property](target)

  let data = target[property]

  if (!isString(data) && data !== undefined)
    return data

  if (data === undefined)
    data = getProxyProperty(target, property)

  return pThen(data, (res: TargetObject | string | null) => {
    const returnData = checkDisposable({ data: res, target, property })
    return isObject(returnData) ? returnData.value : returnData
  })
}

function set(
  target: Record<string, any>,
  property: string,
  value: any,
) {
  return setItem(target, property, value)
}

function deleteProperty(
  target: Record<string, any>,
  property: string,
) {
  const oldData = getProxyProperty(target, property)
  deleteProxyProperty(target, property)

  pThen(oldData, (res: TargetObject | string | null) => {
    const oldValue = isObject(res) ? res.value : (res || undefined)
    emit(target, property, undefined, oldValue)
  })

  return true
}

export function createProxyStorage(storage: StorageLike) {
  if (!isStorage(storage))
    throw new Error('The parameter should be StorageLike object')

  const proxy = new Proxy(storage, {
    get,
    set,
    deleteProperty,
  })

  setProxy(storage, {})

  return proxy
}
