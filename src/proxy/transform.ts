import { TargetObject } from '../shared';
import { isObject, toRawType, transformEval, transformJSON } from '../utils';
import { createProxyObject } from './object';

export function decode(
  data: string,
  expiredFunc: Function,
): any {
  let originalData: string | TargetObject = data;
  try {
    originalData = transformJSON(data);
  } catch(e) {}

  if(!isObject(originalData)) {
    return originalData;
  }

  if(originalData.expires && new Date(+originalData.expires).getTime() <= Date.now()) {
    expiredFunc();
    return undefined;
  }

  let result: any;
  switch(originalData.type) {
    case 'Number':
      result = +originalData.value;
      break;
    case 'BigInt':
      result = BigInt(originalData.value as string);
      break;
    case 'Boolean':
      result = originalData.value === 'true';
      break;
    case 'Null':
      result = null;
      break;
    case 'Undefined':
      result = undefined;
      break;
    case 'Object':
    case 'Array':
      result = createProxyObject(originalData.value as object);
      break;
    case 'Set':
      result = new Set(originalData.value as Array<any>);
      break;
    case 'Map':
      result = new Map(originalData.value as Array<[any, any]>);
      break;
    case 'Date':
      result = new Date(originalData.value as string);
      break;
    case 'RegExp':
      result = transformEval(originalData.value as string);
      break;
    case 'Function':
      result = transformEval(`(function() { return ${originalData.value} })()`);
      break;
    default:
      result = originalData.value;
  }
  return result;
}

export function encode(
  data: any,
  expires?: string
) {
  const rawType = toRawType(data);
  let targetObject: TargetObject = {
    type: rawType,
    value: data
  };

  if(expires) {
    targetObject.expires = expires;
  }

  switch(rawType) {
    case 'String':
    case 'Number':
    case 'BigInt':
    case 'Boolean':
    case 'Null':
    case 'Undefined':
    case 'Date':
    case 'RegExp':
    case 'Function':
      targetObject.value = '' + data;
      break;
    case 'Object':
    case 'Array':
      // JSON.stringify don't know how to serialize a BigInt
      break;
    case 'Set':
    case 'Map':
      targetObject.value = Array.from(data);
      break;
    default:
      throw new Error(`can't set "${rawType}" property.`);
  }
  return JSON.stringify(targetObject);
}