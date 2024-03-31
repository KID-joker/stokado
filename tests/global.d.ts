import { StorageLike } from "@/types"

declare global {
  interface Window {
    stokado: {
      createProxyStorage: Function
    },
    localforage: StorageLike
  }
}
