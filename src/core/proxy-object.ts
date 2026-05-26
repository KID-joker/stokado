import type { StorageOperator } from './operator'
import { hasChanged, hasOwn, isIntegerKey } from '@/utils'

const ARRAY_MUTATION_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'] as const

export function createObjectProxy(
  rawValue: Record<string, any>,
  key: string,
  operator: StorageOperator,
): any {
  let mutating = false

  const proxy = new Proxy(rawValue, {
    get(target, prop: string, receiver) {
      if (Array.isArray(target) && ARRAY_MUTATION_METHODS.includes(prop as any)) {
        return (...args: any[]) => {
          mutating = true
          const oldLength = target.length
          try {
            const result = (target as any)[prop](...args)
            operator.onObjectPropertySet(key, target)
            if (target.length !== oldLength) {
              operator.emitter.emit(`${key}.length`, target.length, oldLength)
            }
            return result
          } finally {
            mutating = false
          }
        }
      }
      return Reflect.get(target, prop, receiver)
    },

    set(target, prop: string, value, receiver) {
      const isArr = Array.isArray(target)
      const arrayLength: number | undefined = isArr ? target.length : undefined
      const oldValue = (target as any)[prop]
      const hadKey = (isArr && isIntegerKey(prop))
        ? Number(prop) < target.length
        : hasOwn(target, prop)

      const result = Reflect.set(target, prop, value, receiver)

      if (result && hasChanged(value, oldValue)) {
        const isIntKey = isArr && isIntegerKey(prop)
        const subKey = isIntKey ? `${key}[${prop}]` : `${key}.${prop}`
        operator.emitter.emit(subKey, value, hadKey ? oldValue : undefined)

        if (!mutating) {
          if (prop !== 'length' && arrayLength !== undefined && target.length !== arrayLength) {
            operator.emitter.emit(`${key}.length`, target.length, arrayLength)
          }
          operator.onObjectPropertySet(key, target)
        }
      }

      return result
    },

    deleteProperty(target, prop: string) {
      const hadKey = hasOwn(target, prop)
      const oldValue = (target as any)[prop]
      const result = Reflect.deleteProperty(target, prop)

      if (result && hadKey) {
        const isArr = Array.isArray(target)
        const isIntKey = isArr && isIntegerKey(prop)
        const subKey = isIntKey ? `${key}[${prop}]` : `${key}.${prop}`
        operator.emitter.emit(subKey, undefined, oldValue)
        operator.onObjectPropertySet(key, target)
      }

      return result
    },
  })

  return proxy
}
