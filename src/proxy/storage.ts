import { getExpires, removeExpires, setExpires } from '../extends/expires';
import { activeEffect, createExpiredFunc, EffectFn, expiresType, prefix, proxyMap, shouldTrack, StorageLike } from '../shared';
import { hasChanged, hasOwn, propertyIsInPrototype } from '../utils';
import { emit, off, on, once } from '../extends/watch';
import { decode, encode } from './transform';

function createInstrumentations(
  target: object,
  receiver: any
) {
  const instrumentations: Record<string, Function> = {};
  
  (['clear', 'key'] as const).forEach(key => {
    instrumentations[key] = target[key].bind(target);
  });

  instrumentations.getItem = function(keyName: string) {
    return get(target, keyName, receiver);
  };
  instrumentations.removeItem = function(keyName: string) {
    return deleteProperty(target, keyName);
  };
  instrumentations.setItem = function(keyName: string, keyValue: any) {
    return set(target, keyName, keyValue, receiver);
  };

  instrumentations.getExpires = function(keyName: string) {
    return getExpires(target, keyName);
  }
  instrumentations.removeExpires = function(keyName: string) {
    return removeExpires(target, keyName, receiver);
  }
  instrumentations.setExpires = function(keyName: string, keyValue: expiresType) {
    return setExpires(target, keyName, keyValue, receiver);
  }

  instrumentations.off = function(key?: string, fn?: EffectFn) {
    off(target, key, fn);
  }
  instrumentations.on = function(key: string, fn: EffectFn) {
    on(target, key, fn);
  }
  instrumentations.once = function(key: string, fn: EffectFn) {
    once(target, key, fn);
  }

  return instrumentations;
}

let instrumentations: Record<string, Function>;
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

  if(!instrumentations) {
    instrumentations = createInstrumentations(target, receiver);
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
    return {};
  }

  const proxy = new Proxy(storage, {
    get,
    set,
    has,
    deleteProperty,
  });
  
  return proxy;
}