import { StorageLike } from "@/types"

declare global {
  interface Window {
    proxyWebStorage: {
      local: StorageLike
      session: StorageLike
    }
  }
}
