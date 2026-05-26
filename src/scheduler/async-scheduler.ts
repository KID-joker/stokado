import type { Scheduler } from './types'

export class AsyncScheduler implements Scheduler {
  readonly isAsync = true

  private queues = new Map<string, Promise<any>>()

  enqueue<T>(key: string, operation: () => T | Promise<T>): Promise<T> {
    const prev = (this.queues.get(key) ?? Promise.resolve()).catch(() => {})
    const next = prev.then(() => operation()).then(
      (result) => {
        if (this.queues.get(key) === next) {
          this.queues.delete(key)
        }
        return result
      },
      (error) => {
        if (this.queues.get(key) === next) {
          this.queues.delete(key)
        }
        throw error
      },
    )
    this.queues.set(key, next)
    return next
  }

  flush(key: string): Promise<void> {
    return (this.queues.get(key) ?? Promise.resolve()).then(() => {})
  }

  flushAll(): Promise<void> {
    const pending = Array.from(this.queues.values())
    return Promise.all(pending).then(() => {})
  }
}
