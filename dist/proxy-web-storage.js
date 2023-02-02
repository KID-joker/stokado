(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.proxyWebStorage = {}));
})(this, (function (exports) { 'use strict';

    let targetMap = new WeakMap();
    function on(target, key, fn) {
        const effect = {
            ctx: this,
            fn
        };
        let effectMap = targetMap.get(target);
        if (!effectMap) {
            targetMap.set(target, (effectMap = new Map()));
        }
        const effects = effectMap.get(key);
        if (effects) {
            effects.push(effect);
        }
        else {
            effectMap.set(key, [effect]);
        }
    }
    function once(target, key, fn) {
        const that = this;
        const wrapped = (value, oldValue) => {
            off(target, key, wrapped);
            fn.call(that, value, oldValue);
        };
        // in order to filter
        wrapped.fn = fn;
        on(target, key, wrapped);
    }
    function off(target, key, fn) {
        if (key === undefined) {
            targetMap.set(target, new Map());
            return;
        }
        let effectMap = targetMap.get(target);
        if (effectMap) {
            const effects = effectMap.get(key);
            if (effects && effects.length > 0) {
                let value = [];
                if (fn) {
                    value = effects.filter(ele => !(ele.fn === fn || ele.fn?.fn === fn));
                }
                effectMap.set(key, value);
            }
        }
    }
    function emit(target, key, ...args) {
        const effectMap = targetMap.get(target);
        if (effectMap) {
            const effects = effectMap.get(key);
            if (effects) {
                const [value, oldValue] = args;
                effects.forEach(ele => ele.fn.call(ele.ctx, value, oldValue));
            }
        }
    }

    const isArray = Array.isArray;
    const isDate = (val) => getTypeString(val) === '[object Date]';
    const isString = (val) => typeof val === 'string';
    const isObject = (val) => val !== null && typeof val === 'object';
    const isIntegerKey = (key) => typeof key === 'string' &&
        key !== 'NaN' &&
        key[0] !== '-' &&
        '' + parseInt(key, 10) === key;
    const getTypeString = (value) => Object.prototype.toString.call(value);
    const getRawType = (value) => {
        return getTypeString(value).slice(8, -1);
    };
    const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
    function transformJSON(data) {
        try {
            return JSON.parse(data);
        }
        catch (e) {
            return data;
        }
    }
    // prototies exist in the prototype chain
    function propertyIsInPrototype(object, prototypeName) {
        return !object.hasOwnProperty(prototypeName) && (prototypeName in object);
    }
    const hasOwnProperty = Object.prototype.hasOwnProperty;
    const hasOwn = (val, key) => hasOwnProperty.call(val, key);
    function transformEval(code) {
        // runs in the global scope rather than the local one
        const eval2 = eval;
        return (function () {
            return eval2(code);
        })();
    }

    let prefix = '';
    function setPrefix(str) {
        prefix = `${str}:`;
    }
    const proxyMap = new WeakMap();
    const activeEffect = { storage: {}, key: '', proxy: {} };
    let shouldTrack = true;
    function pauseTracking() {
        shouldTrack = false;
    }
    function enableTracking() {
        shouldTrack = true;
    }
    function createExpiredFunc(target, key) {
        return function () {
            delete target[key];
        };
    }

    function selfEmit(obj, key, ...args) {
        let actualKey = `${activeEffect.key}.${key}`;
        if (isArray(obj) && isIntegerKey(key)) {
            actualKey = `${activeEffect.key}[${key}]`;
        }
        emit(activeEffect.storage, actualKey, ...args);
    }
    let lengthAltering = false;
    function createInstrumentations$1() {
        const instrumentations = {};
        // instrument length-altering mutation methods to track length
        ['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
            instrumentations[key] = function (...args) {
                lengthAltering = true;
                const oldLength = this.length;
                const res = proxyMap.get(this)[key].apply(this, args);
                if (this.length > oldLength) {
                    selfEmit(this, 'length', this.length, oldLength);
                }
                lengthAltering = false;
                return res;
            };
        });
        return instrumentations;
    }
    const arrayInstrumentations = createInstrumentations$1();
    function get$1(target, property, receiver) {
        if (isArray(target) && hasOwn(arrayInstrumentations, property)) {
            return Reflect.get(arrayInstrumentations, property, receiver);
        }
        return Reflect.get(target, property, receiver);
    }
    function setStorageValue(value) {
        pauseTracking();
        let date = activeEffect.proxy.getExpires(activeEffect.key);
        activeEffect.proxy[activeEffect.key] = value;
        if (date) {
            activeEffect.proxy.setExpires(activeEffect.key, date);
        }
        enableTracking();
    }
    function set$1(target, key, value, receiver) {
        let arrayLength;
        if (isArray(target) && !lengthAltering) {
            arrayLength = target.length;
        }
        const oldValue = target[key];
        const hadKey = isArray(target) && isIntegerKey(key)
            ? Number(key) < target.length
            : hasOwn(target, key);
        const result = Reflect.set(target, key, value, receiver);
        if (result && hasChanged(value, oldValue)) {
            if (hadKey) {
                selfEmit(target, key, value, oldValue);
            }
            else {
                selfEmit(target, key, value, undefined);
            }
            // track `array[3] = 3` length
            if (isArray(target) && arrayLength !== undefined && Number(key) >= arrayLength) {
                selfEmit(target, 'length', target.length, arrayLength);
            }
            setStorageValue(target);
        }
        return result;
    }
    function deleteProperty$1(target, key) {
        const hadKey = hasOwn(target, key);
        const oldValue = target[key];
        const result = Reflect.deleteProperty(target, key);
        if (result && hadKey) {
            selfEmit(target, key, undefined, oldValue);
            setStorageValue(target);
        }
        return result;
    }
    function createProxyObject(target) {
        const proxy = new Proxy(target, {
            get: get$1,
            set: set$1,
            deleteProperty: deleteProperty$1
        });
        proxyMap.set(proxy, target);
        return proxy;
    }

    const StorageSerializers = {
        String: {
            read: (v) => v,
            write: (v) => v
        },
        Number: {
            read: (v) => Number.parseFloat(v),
            write: (v) => String(v)
        },
        BigInt: {
            read: (v) => BigInt(v),
            write: (v) => String(v)
        },
        Boolean: {
            read: (v) => v === 'true',
            write: (v) => String(v)
        },
        Null: {
            read: () => null,
            write: (v) => String(v)
        },
        Undefined: {
            read: () => undefined,
            write: (v) => String(v)
        },
        Object: {
            read: (v) => createProxyObject(v),
            write: (v) => v
        },
        Array: {
            read: (v) => createProxyObject(v),
            write: (v) => v
        },
        Set: {
            read: (v) => new Set(v),
            write: (v) => Array.from(v)
        },
        Map: {
            read: (v) => new Map(v),
            write: (v) => Array.from(v)
        },
        Date: {
            read: (v) => new Date(v),
            write: (v) => String(v)
        },
        RegExp: {
            read: (v) => transformEval(v),
            write: (v) => String(v)
        },
        Function: {
            read: (v) => transformEval(`(function() { return ${v} })()`),
            write: (v) => String(v)
        }
    };
    function decode(data, expiredFunc) {
        let originalData = data;
        try {
            originalData = transformJSON(data);
        }
        catch (e) { }
        if (!isObject(originalData)) {
            return originalData;
        }
        if (originalData.expires && new Date(+originalData.expires).getTime() <= Date.now()) {
            expiredFunc();
            return undefined;
        }
        const serializer = StorageSerializers[originalData.type];
        if (!serializer) {
            return originalData.value;
        }
        return serializer.read(originalData.value);
    }
    function encode(data, expires) {
        const rawType = getRawType(data);
        const serializer = StorageSerializers[rawType];
        if (!serializer) {
            throw new Error(`can't set "${rawType}" property.`);
        }
        let targetObject = {
            type: rawType,
            value: serializer.write(data)
        };
        if (expires) {
            targetObject.expires = expires;
        }
        return JSON.stringify(targetObject);
    }

    function setExpires(target, property, value, receiver) {
        let time;
        if (isDate(value)) {
            time = value.getTime();
        }
        else if (isString(value)) {
            time = +value.padEnd(13, '0');
        }
        else {
            time = value;
        }
        if (time <= Date.now()) {
            delete receiver[property];
            return undefined;
        }
        let data = receiver[property];
        if (!data) {
            return undefined;
        }
        data = proxyMap.get(data) || data;
        target[`${prefix}${property}`] = encode(data, '' + time);
        return new Date(time);
    }
    function getExpires(target, property) {
        const key = `${prefix}${property}`;
        if (!target[key]) {
            return undefined;
        }
        let data = transformJSON(target[key]);
        if (!isObject(data) || !data.expires || +data.expires <= Date.now()) {
            return undefined;
        }
        return new Date(+data.expires);
    }
    function removeExpires(target, property, receiver) {
        let data = receiver[property];
        if (!data) {
            return undefined;
        }
        data = proxyMap.get(data) || data;
        target[`${prefix}${property}`] = encode(data);
        return undefined;
    }

    function createInstrumentations(target, receiver) {
        const instrumentations = {};
        ['clear', 'key'].forEach(key => {
            instrumentations[key] = target[key].bind(target);
        });
        const needReceiverFuncMap = {
            getItem: get,
            setItem: set,
            setExpires,
            removeExpires
        };
        Object.keys(needReceiverFuncMap).forEach(key => {
            instrumentations[key] = function (...args) {
                return needReceiverFuncMap[key](target, ...args, receiver);
            };
        });
        const notNeedReceiverFuncMap = {
            removeItem: deleteProperty,
            getExpires,
            off,
            on,
            once
        };
        Object.keys(notNeedReceiverFuncMap).forEach(key => {
            instrumentations[key] = function (...args) {
                return notNeedReceiverFuncMap[key](target, ...args);
            };
        });
        return instrumentations;
    }
    const storageInstrumentations = new Map();
    function get(target, property, receiver) {
        // records the parent of array and object
        if (shouldTrack) {
            activeEffect.storage = target;
            activeEffect.key = property;
            activeEffect.proxy = receiver;
        }
        let instrumentations = storageInstrumentations.get(target);
        if (!instrumentations) {
            instrumentations = createInstrumentations(target, receiver);
            storageInstrumentations.set(target, instrumentations);
        }
        if (hasOwn(instrumentations, property)) {
            return Reflect.get(instrumentations, property, receiver);
        }
        if (!has(target, property)) {
            return undefined;
        }
        const key = `${prefix}${property}`;
        const value = target[key] || target[property];
        if (!value) {
            return value;
        }
        return decode(value, createExpiredFunc(target, key));
    }
    function set(target, property, value, receiver) {
        const key = `${prefix}${property}`;
        let oldValue = decode(target[key], createExpiredFunc(target, key));
        oldValue = proxyMap.get(oldValue) || oldValue;
        const encodeValue = encode(value);
        const result = Reflect.set(target, key, encodeValue, receiver);
        if (result && hasChanged(value, oldValue) && shouldTrack) {
            emit(target, property, value, oldValue);
        }
        return result;
    }
    // only prefixed properties are accepted in the instance
    function has(target, property) {
        return target.hasOwnProperty(`${prefix}${property}`) || propertyIsInPrototype(target, property);
    }
    function deleteProperty(target, property) {
        const key = `${prefix}${property}`;
        const hadKey = hasOwn(target, key);
        let oldValue = decode(target[key], createExpiredFunc(target, key));
        oldValue = proxyMap.get(oldValue) || oldValue;
        const result = Reflect.deleteProperty(target, key);
        if (result && hadKey) {
            emit(target, property, undefined, oldValue);
        }
        return result;
    }
    function createProxyStorage(storage) {
        if (!storage) {
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

    const local = createProxyStorage(localStorage);
    const session = createProxyStorage(sessionStorage);
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith(prefix)) {
                let newValue = e.newValue, oldValue = e.oldValue;
                if (e.newValue) {
                    newValue = decode(e.newValue, createExpiredFunc(localStorage, e.key));
                    if (isObject(newValue)) {
                        newValue = proxyMap.get(newValue) || newValue;
                    }
                }
                if (e.oldValue) {
                    oldValue = decode(e.oldValue, createExpiredFunc(localStorage, e.key));
                    if (isObject(oldValue)) {
                        oldValue = proxyMap.get(oldValue) || oldValue;
                    }
                }
                emit(localStorage, e.key.slice(prefix.length), newValue, oldValue);
            }
        });
    }

    exports.local = local;
    exports.session = session;
    exports.setPrefix = setPrefix;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
