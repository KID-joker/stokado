import type { ActiveEffect } from './types'

let prefix = ''
export function setPrefix(str: string) {
  prefix = `${str}:`
}
export function getPrefix() {
  return prefix
}

export const proxyMap = new WeakMap<object, object>()

export const activeEffect: ActiveEffect = { storage: {}, key: '', proxy: {} }

let shouldTrack = true
export function pauseTracking() {
  shouldTrack = false
}
export function enableTracking() {
  shouldTrack = true
}
export function getShouldTrack() {
  return shouldTrack
}

export function createExpiredFunc(
  target: object,
  key: string,
) {
  return function () {
    delete target[key]
  }
}
