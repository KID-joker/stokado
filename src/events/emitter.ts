export type Listener = (newValue: any, oldValue: any) => void

interface WrappedListener {
  fn: Listener
  originalFn?: Listener
}

export class EventEmitter {
  private listeners = new Map<string, WrappedListener[]>()

  on(key: string, fn: Listener): void {
    const list = this.listeners.get(key) ?? []
    list.push({ fn })
    this.listeners.set(key, list)
  }

  once(key: string, fn: Listener): void {
    const wrapped: Listener = (newValue, oldValue) => {
      this.off(key, fn)
      fn(newValue, oldValue)
    }
    const list = this.listeners.get(key) ?? []
    list.push({ fn: wrapped, originalFn: fn })
    this.listeners.set(key, list)
  }

  off(key: string, fn?: Listener): void {
    if (!fn) {
      this.listeners.delete(key)
      return
    }
    const list = this.listeners.get(key)
    if (!list)
      return
    const filtered = list.filter(w => w.fn !== fn && w.originalFn !== fn)
    if (filtered.length === 0) {
      this.listeners.delete(key)
    }
    else {
      this.listeners.set(key, filtered)
    }
  }

  offAll(): void {
    this.listeners.clear()
  }

  emit(key: string, newValue: any, oldValue: any): void {
    const list = this.listeners.get(key)
    if (!list)
      return
    const snapshot = [...list]
    for (const { fn } of snapshot) {
      fn(newValue, oldValue)
    }
  }

  getRegisteredKeys(): string[] {
    return Array.from(this.listeners.keys())
  }
}
