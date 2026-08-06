import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import type { ExtractedBriefItem } from '@/lib/brief-extraction'

export async function createBriefItems(
  payload: Payload,
  user: User,
  briefId: string,
  items: (ExtractedBriefItem & { id?: string })[],
): Promise<void> {
  for (const { id: _id, ...item } of items) {
    await payload.create({
      collection: 'brief-items',
      data: { brief: briefId, status: 'pending', ...item },
      overrideAccess: false,
      user,
    })
  }
}
