interface Serializer<T = any> {
  encode: (value: T) => string
  decode: (raw: string) => T
}

const identity = (v: any): any => v
const toString = (v: any): string => String(v)

export const serializers: Record<string, Serializer> = {
  String: {
    encode: identity,
    decode: identity,
  },
  Number: {
    encode: toString,
    decode: s => Number.parseFloat(s),
  },
  BigInt: {
    encode: toString,
    decode: s => BigInt(s),
  },
  Boolean: {
    encode: toString,
    decode: s => s === 'true',
  },
  Null: {
    encode: () => 'null',
    decode: () => null,
  },
  Undefined: {
    encode: () => 'undefined',
    decode: () => undefined,
  },
  Object: {
    encode: identity as (v: any) => any,
    decode: identity as (v: any) => any,
  },
  Array: {
    encode: identity as (v: any) => any,
    decode: identity as (v: any) => any,
  },
  Set: {
    encode: v => JSON.stringify([...v]),
    decode: s => new Set(JSON.parse(s)),
  },
  Map: {
    encode: v => JSON.stringify([...v]),
    decode: s => new Map(JSON.parse(s)),
  },
  Date: {
    encode: v => v.toISOString(),
    decode: s => new Date(s),
  },
  URL: {
    encode: v => v.href,
    decode: s => new URL(s),
  },
  RegExp: {
    encode: toString,
    decode: (s) => {
      const match = s.match(/^\/(.*)\/([gimsuy]*)$/)
      if (match)
        return new RegExp(match[1], match[2])
      return new RegExp(s)
    },
  },
  Function: {
    encode: toString,
    decode: (s) => {
      // eslint-disable-next-line no-new-func
      return new Function(`return ${s}`)()
    },
  },
}
