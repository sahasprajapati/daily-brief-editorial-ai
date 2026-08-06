import { describe, expect, test } from 'bun:test'
import type { EditorialBrief, User } from '@/payload-types'
import { createNextBriefVersion } from './versioning'

function fakePayload() {
  const calls: { collection: string; op: string; data: any; id?: string }[] = []
  return {
    calls,
    payload: {
      update: async ({ collection, id, data }: any) => {
        calls.push({ collection, op: 'update', id, data })
        return { id, ...data }
      },
      create: async ({ collection, data }: any) => {
        calls.push({ collection, op: 'create', data })
        return { id: `${collection}-new`, ...data }
      },
    },
  }
}

const user = { id: 'lead-1', role: 'editor' } as User
const previous = { id: 'brief-1', channel: 'ch-1', version: 1, status: 'confirmed' } as EditorialBrief

describe('createNextBriefVersion', () => {
  test('supersedes the previous brief and creates a new parsed draft with the next version number', async () => {
    const { payload, calls } = fakePayload()

    const result = await createNextBriefVersion({
      payload: payload as any,
      user,
      previous,
      items: [{ topic: 'T', keywords: [], angle: 'A', priorityOrder: 1, exclusions: [], bannedTerms: [] } as any],
      rawParseSnapshot: [{ topic: 'T' }],
      sourceType: 'paste',
      rawText: 'raw text',
      title: 'Brief title',
    })

    expect(calls[0]).toMatchObject({ collection: 'editorial-briefs', op: 'update', id: 'brief-1', data: { status: 'superseded' } })
    expect(calls[1]).toMatchObject({
      collection: 'editorial-briefs',
      op: 'create',
      data: { channel: 'ch-1', status: 'parsed', version: 2, previousVersion: 'brief-1' },
    })
    expect(calls[2]).toMatchObject({ collection: 'brief-items', op: 'create', data: { topic: 'T' } })
    expect(result.version).toBe(2)
  })
})
