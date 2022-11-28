import { ActiveEffect } from "./types";

export let prefix = '';
export function setPrefix(str: string) {
  prefix = `${str}:`;
}

export const proxyMap = new WeakMap<object, object>();

export const activeEffect: ActiveEffect = { storage: {}, key: '', proxy: {} };

export let shouldTrack = true;
export function pauseTracking() {
  shouldTrack = false
}
export function enableTracking() {
  shouldTrack = true
}

export function createExpiredFunc(
  target: object,
  key: string
) {
  return function() {
    delete target[key];
  }
}
