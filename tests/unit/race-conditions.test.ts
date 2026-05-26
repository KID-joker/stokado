import { describe, expect, it } from 'vitest'
import { CacheStore } from '@/cache/store'
import { StorageOperator } from '@/core/operator'
import { StorageBroadcast } from '@/events/broadcast'
import { EventEmitter } from '@/events/emitter'
import { AsyncScheduler } from '@/scheduler/async-scheduler'
import { AsyncStrategy } from '@/strategy/async-strategy'

function createMockAsyncStorage() {
  const store = new Map<string, string>()
  const delayMs = 10
  return {
    getItem: async (key: string) => {
      await new Promise(r => setTimeout(r, delayMs))
      return store.get(key) ?? null
    },
    setItem: async (key: string, value: string) => {
      await new Promise(r => setTimeout(r, delayMs))
      store.set(key, value)
    },
    removeItem: async (key: string) => {
      await new Promise(r => setTimeout(r, delayMs))
      store.delete(key)
    },
    clear: async () => {
      await new Promise(r => setTimeout(r, delayMs))
      store.clear()
    },
    key: async (index: number) => Array.from(store.keys())[index] ?? null,
    length: async () => store.size,
  }
}

function createAsyncOperator() {
  const storage = createMockAsyncStorage()
  return new StorageOperator(
    storage,
    new AsyncScheduler(),
    new AsyncStrategy(),
    new CacheStore(),
    new EventEmitter(),
    new StorageBroadcast(null),
    null,
  )
}

describe('race Conditions', () => {
  it('concurrent setItem on same key serializes correctly', async () => {
    const op = createAsyncOperator()
    const results: string[] = []

    const p1 = op.setItem('key', 'first').then(() => results.push('first'))
    const p2 = op.setItem('key', 'second').then(() => results.push('second'))
    const p3 = op.setItem('key', 'third').then(() => results.push('third'))

    await Promise.all([p1, p2, p3])
    expect(results).toEqual(['first', 'second', 'third'])
    expect(await op.getItem('key')).toBe('third')
  })

  it('getItem after setItem on same key returns new value', async () => {
    const op = createAsyncOperator()
    await op.setItem('key', 'old')
    const setP = op.setItem('key', 'new')
    const getP = op.getItem('key')
    await setP
    expect(await getP).toBe('new')
  })

  it('getItem after removeItem on same key returns null', async () => {
    const op = createAsyncOperator()
    await op.setItem('key', 'value')
    const removeP = op.removeItem('key')
    const getP = op.getItem('key')
    await removeP
    expect(await getP).toBeNull()
  })

  it('removeItem after setItem on same key removes the value', async () => {
    const op = createAsyncOperator()
    const setP = op.setItem('key', 'value')
    const removeP = op.removeItem('key')
    await setP
    await removeP
    expect(await op.getItem('key')).toBeNull()
  })

  it('clear after setItem clears all values', async () => {
    const op = createAsyncOperator()
    const p1 = op.setItem('a', 1)
    const p2 = op.setItem('b', 2)
    await Promise.all([p1, p2])
    await op.clear()
    expect(await op.getItem('a')).toBeNull()
    expect(await op.getItem('b')).toBeNull()
  })

  it('events fire in correct order for serialized operations', async () => {
    const op = createAsyncOperator()
    const events: string[] = []

    op.emitter.on('key', (newVal: any) => {
      events.push(newVal)
    })

    await op.setItem('key', 'first')
    await op.setItem('key', 'second')
    await op.removeItem('key')

    expect(events).toEqual(['first', 'second', undefined])
  })

  it('setExpires then getItem returns value before expiry', async () => {
    const op = createAsyncOperator()
    await op.setItem('key', 'value')
    await op.setExpires('key', Date.now() + 5000)
    expect(await op.getItem('key')).toBe('value')
  })

  it('setExpires with past time removes the value', async () => {
    const op = createAsyncOperator()
    await op.setItem('key', 'value')
    await op.setExpires('key', Date.now() - 1000)
    expect(await op.getItem('key')).toBeNull()
  })

  it('disposable value is consumed on first read', async () => {
    const op = createAsyncOperator()
    await op.setItem('key', 'value')
    await op.setDisposable('key')
    expect(await op.getItem('key')).toBe('value')
    expect(await op.getItem('key')).toBeNull()
  })

  it('concurrent operations on different keys run in parallel', async () => {
    const op = createAsyncOperator()
    const start = Date.now()

    await Promise.all([
      op.setItem('a', 1),
      op.setItem('b', 2),
      op.setItem('c', 3),
    ])

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(100)
  })

  it('flush waits for pending operations', async () => {
    const op = createAsyncOperator()
    let resolved = false

    op.setItem('key', 'value').then(() => {
      resolved = true
    })

    await (op as any).scheduler.flush('key')
    expect(resolved).toBe(true)
  })
})
