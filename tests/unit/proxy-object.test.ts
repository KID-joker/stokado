import { describe, expect, it, vi } from 'vitest'
import { createObjectProxy } from '@/core/proxy-object'

describe('createObjectProxy', () => {
  function createMockOperator() {
    return {
      onObjectPropertySet: vi.fn(),
      emitter: {
        emit: vi.fn(),
      },
    }
  }

  it('get returns property value', () => {
    const operator = createMockOperator()
    const proxy = createObjectProxy({ a: 1, b: 2 }, 'key', operator as any)
    expect(proxy.a).toBe(1)
    expect(proxy.b).toBe(2)
  })

  it('set triggers onObjectPropertySet and emits sub-key event', () => {
    const operator = createMockOperator()
    const raw = { name: 'old' }
    const proxy = createObjectProxy(raw, 'user', operator as any)
    proxy.name = 'new'
    expect(raw.name).toBe('new')
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('user', raw)
    expect(operator.emitter.emit).toHaveBeenCalledWith('user.name', 'new', 'old')
  })

  it('delete triggers onObjectPropertySet and emits sub-key event', () => {
    const operator = createMockOperator()
    const raw: any = { name: 'val' }
    const proxy = createObjectProxy(raw, 'key', operator as any)
    delete proxy.name
    expect(raw.name).toBeUndefined()
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('key', raw)
    expect(operator.emitter.emit).toHaveBeenCalledWith('key.name', undefined, 'val')
  })

  it('array push triggers onObjectPropertySet and length event', () => {
    const operator = createMockOperator()
    const raw: any[] = ['a']
    const proxy = createObjectProxy(raw, 'list', operator as any)
    proxy.push('b')
    expect(raw).toEqual(['a', 'b'])
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('list', raw)
    expect(operator.emitter.emit).toHaveBeenCalledWith('list.length', 2, 1)
  })

  it('array pop triggers onObjectPropertySet and length event', () => {
    const operator = createMockOperator()
    const raw = ['a', 'b']
    const proxy = createObjectProxy(raw, 'list', operator as any)
    const result = proxy.pop()
    expect(result).toBe('b')
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('list', raw)
    expect(operator.emitter.emit).toHaveBeenCalledWith('list.length', 1, 2)
  })

  it('array index set triggers sub-key event', () => {
    const operator = createMockOperator()
    const raw = ['old']
    const proxy = createObjectProxy(raw, 'list', operator as any)
    proxy[0] = 'new'
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('list', raw)
    expect(operator.emitter.emit).toHaveBeenCalledWith('list[0]', 'new', 'old')
  })

  it('does not emit if value unchanged', () => {
    const operator = createMockOperator()
    const raw = { name: 'same' }
    const proxy = createObjectProxy(raw, 'key', operator as any)
    proxy.name = 'same'
    expect(operator.onObjectPropertySet).not.toHaveBeenCalled()
    expect(operator.emitter.emit).not.toHaveBeenCalled()
  })

  it('array sort triggers onObjectPropertySet', () => {
    const operator = createMockOperator()
    const raw = [3, 1, 2]
    const proxy = createObjectProxy(raw, 'list', operator as any)
    proxy.sort()
    expect(raw).toEqual([1, 2, 3])
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('list', raw)
  })

  it('array reverse triggers onObjectPropertySet', () => {
    const operator = createMockOperator()
    const raw = [1, 2, 3]
    const proxy = createObjectProxy(raw, 'list', operator as any)
    proxy.reverse()
    expect(raw).toEqual([3, 2, 1])
    expect(operator.onObjectPropertySet).toHaveBeenCalledWith('list', raw)
  })

  it('array sort does not emit length event', () => {
    const operator = createMockOperator()
    const raw = [3, 1, 2]
    const proxy = createObjectProxy(raw, 'list', operator as any)
    proxy.sort()
    expect(operator.emitter.emit).not.toHaveBeenCalledWith('list.length', expect.anything(), expect.anything())
  })
})
