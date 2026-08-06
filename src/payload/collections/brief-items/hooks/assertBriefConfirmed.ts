import { APIError } from 'payload'
import type { CollectionBeforeChangeHook } from 'payload'
import type { BriefItem } from '@/payload-types'

/** Data-layer half of the confirm gate: no code in this app triggers provider collection yet,
 *  but whatever eventually does must go through a brief-items status change, and this hook
 *  blocks that change until the parent brief is confirmed - the gate can't be bypassed by
 *  skipping a UI step, per the spec's "not skippable" requirement. */
export const assertBriefConfirmed: CollectionBeforeChangeHook<BriefItem> = async ({
  req,
  data,
  originalDoc,
  operation,
}) => {
  if (operation !== 'update' || !originalDoc) return data
  if (originalDoc.status !== 'pending' || data?.status === undefined || data.status === 'pending') return data

  const brief = await req.payload.findByID({
    collection: 'editorial-briefs',
    id: originalDoc.brief as string,
    depth: 0,
    overrideAccess: true,
  })

  if (brief.status !== 'confirmed') {
    throw new APIError('Cannot advance a brief item before its brief is confirmed', 400)
  }

  return data
}
