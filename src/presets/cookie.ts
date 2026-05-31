import type { SyncStorageLike } from '@/types'

function parseCookies(): Map<string, string> {
  const map = new Map<string, string>()
  if (!document.cookie)
    return map
  document.cookie.split(';').forEach((cookie) => {
    const eqIndex = cookie.indexOf('=')
    if (eqIndex === -1)
      return
    const key = decodeURIComponent(cookie.slice(0, eqIndex).trim())
    const value = decodeURIComponent(cookie.slice(eqIndex + 1).trim())
    map.set(key, value)
  })
  return map
}

export const cookieStorage: SyncStorageLike = {
  getItem(key: string): string | null {
    return parseCookies().get(key) ?? null
  },
  setItem(key: string, value: any): void {
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  },
  removeItem(key: string): void {
    document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  },
  clear(): void {
    const keys = [...parseCookies().keys()]
    for (const key of keys) {
      document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    }
  },
  key(index: number): string | null {
    return [...parseCookies().keys()][index] ?? null
  },
  get length(): number {
    return parseCookies().size
  },
}
