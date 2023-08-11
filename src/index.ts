import { emit } from '@/extends/watch'
import { decode } from '@/proxy/transform'
import { createProxyStorage } from '@/proxy/storage'
import { clearProxy, deleteProxyProperty, prefixInst } from '@/shared'
import type { StorageValue } from '@/types'
import { compose, hasChanged, isArray, isString } from '@/utils'
import { isExpired } from '@/extends/expires'

export const setPrefix: Function = function (value: string) {
  prefixInst.setPrefix(value)
}
export const local: any = createProxyStorage(localStorage)
export const session: any = createProxyStorage(sessionStorage)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    // another tab clears all keys
    if (e.key === null && e.oldValue === null && e.newValue === null)
      clearProxy(localStorage)

    if (e.key && e.key.startsWith(prefixInst.getPrefix())) {
      const property = e.key.slice(prefixInst.getPrefix().length)

      deleteProxyProperty(localStorage, property)
      const oldValue: StorageValue = isString(e.oldValue) ? compose(decode, isExpired)({ data: e.oldValue, target: localStorage, property }) : e.oldValue
      deleteProxyProperty(localStorage, property)
      const newValue: StorageValue = isString(e.newValue) ? compose(decode, isExpired)({ data: e.newValue, target: localStorage, property }) : e.newValue

      hasChanged(newValue, oldValue) && emit(localStorage, property, newValue, oldValue)
      if (isArray(newValue) && isArray(oldValue) && hasChanged(newValue.length, oldValue.length))
        emit(localStorage, `${property}.length`, newValue.length, oldValue.length)
    }
  })
}
