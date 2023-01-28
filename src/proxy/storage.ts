import { getExpires, removeExpires, setExpires } from '../extends/expires';
import { activeEffect, createExpiredFunc, prefix, proxyMap, shouldTrack } from '../shared';
import { hasChanged, hasOwn, propertyIsInPrototype } from '../utils';
import { emit, off, on, once } from '../extends/watch';
import { decode, encode } from './transform';
import { StorageLike } from '../types';

function createInstrumentations(
  target: object,
  receiver: any
) {
  const instrumentations: Record<string, Function> = {};
  
  (['clear', 'key'] as const).forEach(key => {
    instrumentations[key] = target[key].bind(target);
  });

  const needReceiverFuncMap = {
    getItem: get,
    setItem: set,
    setExpires,
    removeExpires
  }
  Object.keys(needReceiverFuncMap).forEach(key => {
    instrumentations[key] = function(...args: unknown[]) {
      return needReceiverFuncMap[key](target, ...args, receiver);
    }
  });

  const notNeedReceiverFuncMap = {
    removeItem: deleteProperty,
    getExpires,
    off,
    on,
    once
  }
  Object.keys(notNeedReceiverFuncMap).forEach(key => {
    instrumentations[key] = function(...args: unknown[]) {
      return notNeedReceiverFuncMap[key](target, ...args);
    }
  });

  return instrumentations;
}

const storageInstrumentations: Map<object, Record<string, Function>> = new Map();
function get(
  target: object,
  property: string,
  receiver: any
) {
  // records the parent of array and object
  if(shouldTrack) {
    activeEffect.storage = target;
    activeEffect.key = property;
    activeEffect.proxy = receiver;
  }

  let instrumentations = storageInstrumentations.get(target);
  if(!instrumentations) {
    instrumentations = createInstrumentations(target, receiver);
    storageInstrumentations.set(target, instrumentations);
  }
  if(hasOwn(instrumentations, property)) {
    return Reflect.get(instrumentations, property, receiver);
  }

  if(!has(target, property)) {
    return undefined;
  }

  const key = `${prefix}${property}`;
  const value = target[key] || target[property];
  if(!value) {
    return value;
  }

  return decode(value, createExpiredFunc(target, key));
}

function set(
  target: object,
  property: string,
  value: any,
  receiver: any
) {
  const key = `${prefix}${property}`;
  let oldValue = decode(target[key], createExpiredFunc(target, key));
  oldValue = proxyMap.get(oldValue) || oldValue;
  const encodeValue = encode(value);
  const result = Reflect.set(target, key, encodeValue, receiver);
  if(result && hasChanged(value, oldValue) && shouldTrack) {
    emit(target, property, value, oldValue);
  }
  return result;
}

// only prefixed properties are accepted in the instance
function has(
  target: object,
  property: string
): boolean {
  return target.hasOwnProperty(`${prefix}${property}`) || propertyIsInPrototype(target, property);
}

function deleteProperty(
  target: object,
  property: string
) {
  const key = `${prefix}${property}`;
  const hadKey = hasOwn(target, key);
  let oldValue = decode(target[key], createExpiredFunc(target, key));
  oldValue = proxyMap.get(oldValue) || oldValue;
  const result = Reflect.deleteProperty(target, key);
  if(result && hadKey) {
    emit(target, property, undefined, oldValue);
  }
  return result;
}

export function createProxyStorage(storage: StorageLike) {
  if(!storage) {
    return null;
  }

  const proxy = new Proxy(storage, {
    get,
    set,
    has,
    deleteProperty,
  });
  
  return proxy;
}