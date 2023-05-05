import { StorageLike } from "@/types"

declare global {
  interface Window {
    stokado: {
      local: StorageLike
      session: StorageLike
    }
  }
}
