import type { Scheduler } from './types'

export class SyncScheduler implements Scheduler {
  readonly isAsync = false

  enqueue<T>(_key: string, operation: () => T): T {
    return operation()
  }

  flush(_key: string): void {}

  flushAll(): void {}

  startClear(): void {}

  endClear(): void {}
}
