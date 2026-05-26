import type { StorageOperator } from './operator'
import type { StorageOptions } from '@/types'
import { isFunction, isString } from '@/utils'

export function createProxyHandler(operator: StorageOperator): ProxyHandler<any> {
  return {
    get(target, prop: string) {
      switch (prop) {
        case 'getItem':
          return (key: string) => operator.getItem(key)
        case 'setItem':
          return (key: string, value: any, options?: StorageOptions) => operator.setItem(key, value, options)
        case 'removeItem':
          return (key: string) => operator.removeItem(key)
        case 'clear':
          return () => operator.clear()
        case 'key':
          return (index: number) => operator.key(index)
        case 'length': {
          const len = target.length
          return typeof len === 'function'
            ? () => operator.length
            : operator.length
        }
      }

      switch (prop) {
        case 'on':
          return (key: string, fn: any) => operator.emitter.on(key, fn)
        case 'once':
          return (key: string, fn: any) => operator.emitter.once(key, fn)
        case 'off':
          return (key?: string, fn?: any) => {
            if (key === undefined) {
              operator.emitter.offAll()
            } else {
              operator.emitter.off(key, fn)
            }
          }
        case 'setExpires':
          return (key: string, expires: any) => operator.setExpires(key, expires)
        case 'getExpires':
          return (key: string) => operator.getExpires(key)
        case 'removeExpires':
          return (key: string) => operator.removeExpires(key)
        case 'setDisposable':
          return (key: string) => operator.setDisposable(key)
        case 'getOptions':
          return (key: string) => operator.getOptions(key)
      }

      const nativeValue = target[prop]
      if (nativeValue !== undefined && !isString(nativeValue)) {
        return isFunction(nativeValue) ? nativeValue.bind(target) : nativeValue
      }

      const result = operator.getItem(prop)
      if (operator.isAsync) {
        return result.then((v: any) => v === null ? undefined : v)
      }
      return result === null ? undefined : result
    },

    set(_target, prop: string, value) {
      operator.setItem(prop, value)
      return true
    },

    deleteProperty(_target, prop: string) {
      operator.removeItem(prop)
      return true
    },
  }
}
