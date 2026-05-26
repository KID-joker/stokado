import type { StorageOptions } from '@/types'
import { serializers } from './registry'

export interface DecodedItem {
  value: any
  type: string
  options?: StorageOptions
}

export function decode(raw: string | null): DecodedItem | null | string {
  if (raw === null) return null

  let envelope: any
  try {
    envelope = JSON.parse(raw)
  } catch {
    return raw
  }

  if (typeof envelope !== 'object' || envelope === null) {
    return raw
  }

  const serializer = serializers[envelope.type]
  if (!serializer) {
    return envelope
  }

  return {
    value: serializer.decode(envelope.value),
    type: envelope.type,
    options: envelope.options,
  }
}
