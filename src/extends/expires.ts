import { encode } from "../proxy/transform";
import { expiresType, prefix, proxyMap } from "../shared"
import { isDate, isObject, isString, transformJSON } from "../utils";

export function setExpires(
  target: object,
  property: string,
  value: expiresType,
  receiver: any
) {
  let time: number;
  if(isDate(value)) {
    time = value.getTime();
  } else if(isString(value)) {
    time = +value.padEnd(13, '0');
  } else {
    time = value;
  }
  if(time <= Date.now()) {
    delete receiver[property];
    return undefined;
  }

  let data = receiver[property];
  if(!data) {
    return undefined;
  }
  data = proxyMap.get(data) || data;

  target[`${prefix}${property}`] = encode(data, '' + time);
  return new Date(time);
}

export function getExpires(
  target: object,
  property: string
) {
  const key = `${prefix}${property}`;
  if(!target[key]) {
    return undefined;
  }
  let data = transformJSON(target[key]);
  if(!isObject(data) || !data.expires || +data.expires <= Date.now()) {
    return undefined;
  }
  return new Date(+data.expires);
}

export function removeExpires(
  target: object,
  property: string,
  receiver: any
) {
  let data = receiver[property];
  if(!data) {
    return undefined;
  }
  data = proxyMap.get(data) || data;

  target[`${prefix}${property}`] = encode(data);

  return undefined;
}