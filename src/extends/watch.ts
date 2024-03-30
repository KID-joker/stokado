import type { Effect, EffectFn, EffectMap } from '@/types'
import { hasChanged } from '@/utils'

const targetEffectMap = new WeakMap<Object, EffectMap>()

export function on(
  this: any,
  target: object,
  key: string,
  fn: EffectFn,
) {
  const effect: Effect = {
    ctx: this,
    fn,
  }

  let effectMap = targetEffectMap.get(target)
  if (!effectMap)
    targetEffectMap.set(target, (effectMap = new Map()))

  const effects: Effect[] | undefined = effectMap.get(key)
  if (effects)
    effects.push(effect)
  else
    effectMap.set(key, [effect] as Effect[])
}

export function once(
  this: any,
  target: object,
  key: string,
  fn: EffectFn,
) {
  const wrapped = (value: any, oldValue: any) => {
    off(target, key, wrapped)
    fn.call(this, value, oldValue)
  }
  // in order to filter
  wrapped.fn = fn
  on(target, key, wrapped)
}

export function off(
  target: object,
  key?: string,
  fn?: EffectFn,
) {
  if (key === undefined) {
    targetEffectMap.set(target, new Map())
    return
  }

  const effectMap: EffectMap | undefined = targetEffectMap.get(target)
  if (effectMap) {
    const effects: Effect[] | undefined = effectMap.get(key)
    if (effects && effects.length > 0) {
      const value: Effect[] = fn ? effects.filter(ele => !(ele.fn === fn || (ele as any).fn?.fn === fn)) : []

      effectMap.set(key, value)
    }
  }
}

export function emit(
  target: object,
  key: string,
  value: any,
  oldValue: any,
) {
  if (!hasChanged(value, oldValue))
    return

  const effectMap: EffectMap | undefined = targetEffectMap.get(target)
  if (effectMap) {
    const effects: Effect[] | undefined = effectMap.get(key)
    if (effects)
      effects.forEach(ele => ele.fn.call(ele.ctx, value, oldValue))
  }
}
