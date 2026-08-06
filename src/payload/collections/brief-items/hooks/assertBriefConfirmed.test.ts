import { describe, expect, test } from 'bun:test'
import type { PayloadRequest } from 'payload'
import { assertBriefConfirmed } from './assertBriefConfirmed'

function fakeReq(briefStatus: string): PayloadRequest {
  return {
    payload: {
      findByID: async () => ({ id: 'brief-1', status: briefStatus }),
    },
  } as unknown as PayloadRequest
}

describe('assertBriefConfirmed', () => {
  test('allows create operations unconditionally', async () => {
    const result = await assertBriefConfirmed({
      req: fakeReq('parsed'),
      operation: 'create',
      data: { status: 'pending', brief: 'brief-1' },
    } as any)
    expect(result).toEqual({ status: 'pending', brief: 'brief-1' })
  })

  test('allows an update that does not touch status', async () => {
    const data = { topic: 'Updated topic' }
    const result = await assertBriefConfirmed({
      req: fakeReq('parsed'),
      operation: 'update',
      data,
      originalDoc: { status: 'pending', brief: 'brief-1' },
    } as any)
    expect(result).toBe(data)
  })

  test('allows an update when the original item was not pending', async () => {
    const data = { status: 'queried' }
    const result = await assertBriefConfirmed({
      req: fakeReq('parsed'),
      operation: 'update',
      data,
      originalDoc: { status: 'queried', brief: 'brief-1' },
    } as any)
    expect(result).toBe(data)
  })

  test('blocks moving status off pending when the parent brief is not confirmed', async () => {
    const promise = assertBriefConfirmed({
      req: fakeReq('parsed'),
      operation: 'update',
      data: { status: 'queried' },
      originalDoc: { status: 'pending', brief: 'brief-1' },
    } as any)
    await expect(promise).rejects.toThrow('Cannot advance a brief item before its brief is confirmed')
  })

  test('allows moving status off pending when the parent brief is confirmed', async () => {
    const data = { status: 'queried' }
    const result = await assertBriefConfirmed({
      req: fakeReq('confirmed'),
      operation: 'update',
      data,
      originalDoc: { status: 'pending', brief: 'brief-1' },
    } as any)
    expect(result).toBe(data)
  })
})
