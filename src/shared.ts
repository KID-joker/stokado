import { checkExpired } from './extends/expires'
import { decode } from '@/proxy/transform'
import type { TargetObject } from '@/types'
import { pThen } from '@/utils'

const proxyMap = new WeakMap<Record<string, any>, Record<string, any>>()

export function setProxy(target: Record<string, any>, proxy: Record<string, any>): void {
  proxyMap.set(target, proxy)
}

export function clearProxy(target: Record<string, any>): void {
  target.clear()
  proxyMap.set(target, {})
}

export function getProxyProperty(target: Record<string, any>, property: string): TargetObject | string | null {
  const targetProxy = proxyMap.get(target)
  const data = targetProxy![property] || pThen(target.getItem(property), (res: string | null) => {
    return decode({ data: res, target, property })
  })
  return pThen(data, (res: TargetObject | string | null) => {
    return checkExpired({ data: res, target, property })
  })
}

export function deleteProxyProperty(target: Record<string, any>, property: string) {
  const targetProxy = proxyMap.get(target)
  target.removeItem(property)
  delete targetProxy![property]
}

export function setProxyProperty(target: Record<string, any>, property: string, data: TargetObject) {
  const targetProxy = proxyMap.get(target)
  targetProxy![property] = data
}
