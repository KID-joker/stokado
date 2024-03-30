import { checkExpired } from './extends/expires'
import { decode } from '@/proxy/transform'
import type { TargetObject } from '@/types'
import { pThen } from '@/utils'

const proxyStorageMap = new WeakMap<Record<string, any>, Record<string, any>>()

export function setProxyStorage(target: Record<string, any>, proxy: Record<string, any>): void {
  proxyStorageMap.set(target, proxy)
}

export function clearProxyStorage(target: Record<string, any>): void {
  target.clear()
  proxyStorageMap.set(target, {})
}

export function getProxyStorageProperty(target: Record<string, any>, property: string): TargetObject | string | null {
  const targetProxy = proxyStorageMap.get(target)
  const data = targetProxy![property] || pThen(target.getItem(property), (res: string | null) => {
    return decode({ data: res, target, property })
  })
  return pThen(data, (res: TargetObject | string | null) => {
    return checkExpired({ data: res, target, property })
  })
}

export function deleteProxyStorageProperty(target: Record<string, any>, property: string) {
  const targetProxy = proxyStorageMap.get(target)
  target.removeItem(property)
  delete targetProxy![property]
}

export function setProxyStorageProperty(target: Record<string, any>, property: string, data: TargetObject) {
  const targetProxy = proxyStorageMap.get(target)
  targetProxy![property] = data
}
