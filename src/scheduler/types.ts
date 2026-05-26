export interface Scheduler {
  readonly isAsync: boolean
  enqueue: <T>(key: string, operation: () => T | Promise<T>) => T | Promise<T>
  flush: (key: string) => void | Promise<void>
  flushAll: () => void | Promise<void>
}
