import { postMessage } from '@/proxy/broadcast'
import type { Effect, EffectFn, EffectMap, StorageLike } from '@/types'
import { hasChanged } from '@/utils'

const storageEffectMap = new WeakMap<StorageLike, EffectMap>()

export function on(
  this: any,
  storage: StorageLike,
  key: string,
  fn: EffectFn,
) {
  const effect: Effect = {
    ctx: this,
    fn,
  }

  let effectMap = storageEffectMap.get(storage)
  if (!effectMap)
    storageEffectMap.set(storage, (effectMap = new Map()))

  const effects: Effect[] | undefined = effectMap.get(key)
  if (effects)
    effects.push(effect)
  else
    effectMap.set(key, [effect] as Effect[])
}

export function once(
  this: any,
  storage: StorageLike,
  key: string,
  fn: EffectFn,
) {
  const wrapped = (value: any, oldValue: any) => {
    off(storage, key, wrapped)
    fn.call(this, value, oldValue)
  }
  // in order to filter
  wrapped.fn = fn
  on(storage, key, wrapped)
}

export function off(
  storage: StorageLike,
  key?: string,
  fn?: EffectFn,
) {
  if (key === undefined) {
    storageEffectMap.set(storage, new Map())
    return
  }

  const effectMap: EffectMap | undefined = storageEffectMap.get(storage)
  if (effectMap) {
    const effects: Effect[] | undefined = effectMap.get(key)
    if (effects && effects.length > 0) {
      const value: Effect[] = fn ? effects.filter(ele => !(ele.fn === fn || (ele as any).fn?.fn === fn)) : []

      effectMap.set(key, value)
    }
  }
}

export function emit(
  storage: StorageLike,
  key: string,
  value: any,
  oldValue: any,
  property?: string,
) {
  if (!hasChanged(value, oldValue))
    return

  trigger(storage, key, value, oldValue)
  postMessage(storage, key, value, oldValue, property)
}

export function trigger(
  storage: StorageLike,
  key: string,
  value: any,
  oldValue: any,
) {
  const effectMap: EffectMap | undefined = storageEffectMap.get(storage)
  if (effectMap) {
    const effects: Effect[] | undefined = effectMap.get(key)
    if (effects)
      effects.forEach(ele => ele.fn.call(ele.ctx, value, oldValue))
  }
}
