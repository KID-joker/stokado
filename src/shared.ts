import type { ActiveEffect } from '@/types'

class PrefixConstructor {
  private prefix = ''
  setPrefix(str: string) {
    this.prefix = `${str}:`
  }

  getPrefix(): string {
    return this.prefix
  }
}
export const prefixInst = new PrefixConstructor()

export const proxyMap = new WeakMap<Record<string, any>, Record<string, any>>()
export function deleteProxyProperty(target: Record<string, any>, property: string) {
  const targetProxy = proxyMap.get(target)
  delete targetProxy![property]
}
export function clearProxy(target: Record<string, any>) {
  proxyMap.set(target, {})
}

export const activeEffect: ActiveEffect = { storage: {}, key: '', proxy: {}, options: {} }

class ShouldTrackConstructor {
  private tracking = true
  pauseTracking() {
    this.tracking = false
  }

  enableTracking() {
    this.tracking = true
  }

  getTracking(): boolean {
    return this.tracking
  }
}
export const shouldTrackInst = new ShouldTrackConstructor()
