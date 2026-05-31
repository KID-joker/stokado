import type { AsyncStorageLike, SyncStorageLike } from '@/types'
import { createMiniProgramStorage, createMiniProgramStorageAsync } from '@/presets/mini-program'

declare const wx: {
  getStorageSync: (key: string) => any
  setStorageSync: (key: string, data: any) => void
  removeStorageSync: (key: string) => void
  clearStorageSync: () => void
  getStorageInfoSync: () => { keys: string[], currentSize: number, limitSize: number }
  getStorage: (options: { key: string }) => Promise<{ data: any }>
  setStorage: (options: { key: string, data: any }) => Promise<void>
  removeStorage: (options: { key: string }) => Promise<void>
  clearStorage: () => Promise<void>
  getStorageInfo: () => Promise<{ keys: string[], currentSize: number, limitSize: number }>
}

export const wechatStorage: SyncStorageLike = createMiniProgramStorage(wx)
export const wechatStorageAsync: AsyncStorageLike = createMiniProgramStorageAsync(wx)
export { createMiniProgramStorage, createMiniProgramStorageAsync }
