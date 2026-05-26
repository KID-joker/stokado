import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from '@/events/emitter'

describe('EventEmitter', () => {
  it('on registers a listener and emit triggers it', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.on('key', fn)
    emitter.emit('key', 'new', 'old')
    expect(fn).toHaveBeenCalledWith('new', 'old')
  })

  it('emit always fires regardless of value change', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.on('key', fn)
    emitter.emit('key', 'same', 'same')
    expect(fn).toHaveBeenCalledWith('same', 'same')
  })

  it('off removes a specific listener', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.on('key', fn)
    emitter.off('key', fn)
    emitter.emit('key', 'new', 'old')
    expect(fn).not.toHaveBeenCalled()
  })

  it('off without fn removes all listeners for a key', () => {
    const emitter = new EventEmitter()
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    emitter.on('key', fn1)
    emitter.on('key', fn2)
    emitter.off('key')
    emitter.emit('key', 'new', 'old')
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).not.toHaveBeenCalled()
  })

  it('offAll removes all listeners', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.on('a', fn)
    emitter.on('b', fn)
    emitter.offAll()
    emitter.emit('a', 1, 0)
    emitter.emit('b', 1, 0)
    expect(fn).not.toHaveBeenCalled()
  })

  it('once fires only once then auto-removes', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.once('key', fn)
    emitter.emit('key', 1, 0)
    emitter.emit('key', 2, 1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(1, 0)
  })

  it('off can remove a once listener by original fn reference', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.once('key', fn)
    emitter.off('key', fn)
    emitter.emit('key', 1, 0)
    expect(fn).not.toHaveBeenCalled()
  })

  it('multiple listeners on same key', () => {
    const emitter = new EventEmitter()
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    emitter.on('key', fn1)
    emitter.on('key', fn2)
    emitter.emit('key', 'val', undefined)
    expect(fn1).toHaveBeenCalledWith('val', undefined)
    expect(fn2).toHaveBeenCalledWith('val', undefined)
  })

  it('getRegisteredKeys returns all keys with listeners', () => {
    const emitter = new EventEmitter()
    emitter.on('a', () => {})
    emitter.on('b', () => {})
    expect(emitter.getRegisteredKeys()).toEqual(['a', 'b'])
  })

  it('emit triggers even when newValue and oldValue are the same reference', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    const obj = { a: 1 }
    emitter.on('key', fn)
    emitter.emit('key', obj, obj)
    expect(fn).toHaveBeenCalledWith(obj, obj)
  })

  it('emit always fires — hasChanged is the caller responsibility', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    emitter.on('key', fn)
    emitter.emit('key', 'same', 'same')
    expect(fn).toHaveBeenCalledWith('same', 'same')
  })
})
