import type { StorageOptions } from '@/types'
import { serializers } from './registry'
import { getRawType } from '@/utils'

export interface StorageEnvelope {
  type: string
  value: any
  options?: StorageOptions
}

export function encode(data: any, options?: StorageOptions): string {
  const type = getRawType(data)
  const serializer = serializers[type]

  if (!serializer) {
    throw new Error(`Cannot serialize type "${type}"`)
  }

  const envelope: StorageEnvelope = {
    type,
    value: serializer.encode(data),
  }

  if (options && Object.keys(options).length > 0) {
    envelope.options = options
  }

  return JSON.stringify(envelope)
}
