import type { EffectFn } from '@/types'
import { on, off, trigger } from '@/effect'
import { postMessage } from '@/proxy/broadcast'
import { hasChanged } from '@/utils'

export { off, on, trigger } from '@/effect'

export function once(
  this: any,
  storage: object,
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

export function emit(
  storage: object,
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
