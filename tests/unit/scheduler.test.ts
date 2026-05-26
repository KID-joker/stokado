import { describe, expect, it } from 'vitest'
import { AsyncScheduler } from '@/scheduler/async-scheduler'
import { SyncScheduler } from '@/scheduler/sync-scheduler'

describe('syncScheduler', () => {
  it('executes operation directly and returns result', () => {
    const scheduler = new SyncScheduler()
    const result = scheduler.enqueue('key', () => 42)
    expect(result).toBe(42)
  })

  it('flush is a no-op', () => {
    const scheduler = new SyncScheduler()
    expect(scheduler.flush('key')).toBeUndefined()
  })

  it('flushAll is a no-op', () => {
    const scheduler = new SyncScheduler()
    expect(scheduler.flushAll()).toBeUndefined()
  })
})

describe('asyncScheduler', () => {
  it('enqueue returns a Promise', async () => {
    const scheduler = new AsyncScheduler()
    const result = scheduler.enqueue('key', async () => 42)
    expect(result).toBeInstanceOf(Promise)
    expect(await result).toBe(42)
  })

  it('serializes operations on the same key', async () => {
    const scheduler = new AsyncScheduler()
    const order: number[] = []

    const p1 = scheduler.enqueue('a', async () => {
      await delay(50)
      order.push(1)
    })

    const p2 = scheduler.enqueue('a', async () => {
      order.push(2)
    })

    await Promise.all([p1, p2])
    expect(order).toEqual([1, 2])
  })

  it('allows parallel execution on different keys', async () => {
    const scheduler = new AsyncScheduler()
    const order: string[] = []

    const p1 = scheduler.enqueue('a', async () => {
      await delay(50)
      order.push('a')
    })

    const p2 = scheduler.enqueue('b', async () => {
      order.push('b')
    })

    await Promise.all([p1, p2])
    expect(order).toEqual(['b', 'a'])
  })

  it('flush waits for key queue to drain', async () => {
    const scheduler = new AsyncScheduler()
    let done = false

    scheduler.enqueue('a', async () => {
      await delay(50)
      done = true
    })

    await scheduler.flush('a')
    expect(done).toBe(true)
  })

  it('flushAll waits for all queues', async () => {
    const scheduler = new AsyncScheduler()
    const results: string[] = []

    scheduler.enqueue('a', async () => {
      await delay(30)
      results.push('a')
    })

    scheduler.enqueue('b', async () => {
      await delay(20)
      results.push('b')
    })

    await scheduler.flushAll()
    expect(results).toContain('a')
    expect(results).toContain('b')
  })

  it('error in one operation does not block subsequent operations', async () => {
    const scheduler = new AsyncScheduler()

    const p1 = scheduler.enqueue('a', async () => {
      throw new Error('fail')
    })

    const p2 = scheduler.enqueue('a', async () => 'recovered')

    await expect(p1).rejects.toThrow('fail')
    expect(await p2).toBe('recovered')
  })

  it('cleans up idle queues from memory', async () => {
    const scheduler = new AsyncScheduler()

    await scheduler.enqueue('a', async () => 'done')

    expect((scheduler as any).queues.size).toBe(0)
  })
})

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
