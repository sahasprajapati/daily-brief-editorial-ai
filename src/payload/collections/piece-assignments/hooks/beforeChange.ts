import { APIError } from 'payload'
import type { CollectionBeforeChangeHook } from 'payload'
import type { PieceAssignment } from '@/payload-types'

/** Fast-path pre-check for a friendly error message - NOT what makes claiming race-safe by
 *  itself. That guarantee comes from `piece.unique: true` (a real DB constraint); the actual
 *  claim endpoint must still catch the resulting duplicate-key error, since two concurrent
 *  requests can both pass this check before either write lands. */
export const assertClaimAvailable: CollectionBeforeChangeHook<PieceAssignment> = async ({
  req,
  data,
  operation,
}) => {
  if (operation !== 'create') return data

  const existing = await req.payload.find({
    collection: 'piece-assignments',
    where: { piece: { equals: data?.piece } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    const owner = existing.docs[0].assignedTo
    const ownerLabel = typeof owner === 'object' && owner !== null ? owner.email : owner
    throw new APIError(`Already claimed by ${ownerLabel}`, 409)
  }

  return data
}
