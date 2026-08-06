import type { Access, FieldAccess, PayloadRequest } from 'payload'
import type { User } from '@/payload-types'

/** No feature-permission matrix here (unlike trt-global-cms-prod) - this is a fresh app with
 *  two roles. Widen this only when a real second permission dimension shows up. */
export const checkIsAdmin = (user?: User | null): boolean => user?.role === 'admin'

export const adminOnly: Access = ({ req: { user } }) => checkIsAdmin(user as User | null)

export const adminOnlyField: FieldAccess = ({ req: { user } }) => checkIsAdmin(user as User | null)

/** Self-claim only: an authenticated user may create a piece-assignment for themselves,
 *  never for someone else - assigning other editors stays adminOnly (no manager-assigns
 *  flow in this app yet). */
export const selfClaimOnly: Access = ({ req: { user }, data }) => {
  const typedUser = user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!typedUser) return false
  return data?.assignedTo === typedUser.id
}

/** True only if the requesting user is the assignedTo on this piece-assignments doc.
 *  overrideAccess: true on the lookup avoids recursing back into this same check. */
export const ownAssignmentUpdate: Access = async ({ req, id }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!typedUser || !id) return false

  const assignment = await req.payload.findByID({
    collection: 'piece-assignments',
    id,
    depth: 0,
    overrideAccess: true,
  })

  return assignment?.assignedTo === typedUser.id
}

/** True only if the requesting user holds the piece-assignment for this generated-piece.
 *  Does one extra query per check - fine at this app's scale, revisit with a cached
 *  lookup if the pieces list grows large enough to matter. */
const isAssignedToPiece = async (req: PayloadRequest, pieceId: unknown): Promise<boolean> => {
  const typedUser = req.user as User | null
  if (!typedUser || !pieceId) return false

  const assignments = await req.payload.find({
    collection: 'piece-assignments',
    where: { and: [{ piece: { equals: pieceId } }, { assignedTo: { equals: typedUser.id } }] },
    limit: 1,
    overrideAccess: true,
  })

  return assignments.docs.length > 0
}

export const ownAssignedPieceUpdate: Access = async ({ req, id }) => {
  if (checkIsAdmin(req.user as User | null)) return true
  return isAssignedToPiece(req, id)
}

export const ownAssignedVerdictCreate: Access = async ({ req, data }) => {
  if (checkIsAdmin(req.user as User | null)) return true
  return isAssignedToPiece(req, data?.piece)
}

/** A user leads a desk if its external channel id is in their leadOfDesks list - independent
 *  of role: an 'editor' can also be a lead of specific desks, there's no separate 'lead' role. */
export const isLeadOfDesk = (user: User | null, channelId: unknown): boolean =>
  typeof channelId === 'string' && (user?.leadOfDesks ?? []).includes(channelId)

export const leadOfDeskBriefCreate: Access = ({ req: { user }, data }) => {
  const typedUser = user as User | null
  if (checkIsAdmin(typedUser)) return true
  return isLeadOfDesk(typedUser, data?.channel)
}

export const leadOfDeskBriefUpdate: Access = async ({ req, id }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!id) return false
  const brief = await req.payload.findByID({ collection: 'editorial-briefs', id, depth: 0, overrideAccess: true })
  return isLeadOfDesk(typedUser, brief?.channel)
}

/** Brief-items are always created programmatically by the parse/versioning flow, acting as
 *  the lead uploading/re-editing - never by a client naming a brief-items doc directly. Gate
 *  is the same as leadOfDeskBriefItemUpdate but looked up via data.brief since the item
 *  doesn't exist yet to look up its own brief relationship. */
export const leadOfDeskBriefItemCreate: Access = async ({ req, data }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!data?.brief) return false
  const brief = await req.payload.findByID({
    collection: 'editorial-briefs',
    id: data.brief,
    depth: 0,
    overrideAccess: true,
  })
  return isLeadOfDesk(typedUser, brief?.channel)
}

export const leadOfDeskBriefItemUpdate: Access = async ({ req, id }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!id) return false
  const item = await req.payload.findByID({ collection: 'brief-items', id, depth: 1, overrideAccess: true })
  const channel = typeof item?.brief === 'object' ? item.brief.channel : undefined
  return isLeadOfDesk(typedUser, channel)
}

export const leadOfDeskFileCreate: Access = ({ req: { user }, data }) => {
  const typedUser = user as User | null
  if (checkIsAdmin(typedUser)) return true
  return isLeadOfDesk(typedUser, data?.channel)
}

/** Collected-items are always created programmatically by the collection step, acting as the
 *  triggering lead - gated via data.briefItem's parent brief's channel, two hops out since the
 *  item doesn't exist yet to look up its own relationships. */
export const leadOfDeskCollectedItemCreate: Access = async ({ req, data }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!data?.briefItem) return false
  const briefItem = await req.payload.findByID({
    collection: 'brief-items',
    id: data.briefItem,
    depth: 1,
    overrideAccess: true,
  })
  const channel = typeof briefItem?.brief === 'object' ? briefItem.brief.channel : undefined
  return isLeadOfDesk(typedUser, channel)
}

/** Leads may update collected items for their desk (e.g. keep a NewsHQ candidate). */
export const leadOfDeskCollectedItemUpdate: Access = async ({ req, id }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!id) return false
  const item = await req.payload.findByID({
    collection: 'collected-items',
    id,
    depth: 2,
    overrideAccess: true,
  })
  const briefItem = typeof item?.briefItem === 'object' ? item.briefItem : null
  const channel =
    briefItem && typeof briefItem.brief === 'object' ? briefItem.brief.channel : undefined
  return isLeadOfDesk(typedUser, channel)
}

/** generated-pieces.brief is denormalized (see the collection's own doc comment) so this is a
 *  single-hop lookup, unlike leadOfDeskCollectedItemCreate. */
export const leadOfDeskPieceCreate: Access = async ({ req, data }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!data?.brief) return false
  const brief = await req.payload.findByID({
    collection: 'editorial-briefs',
    id: data.brief,
    depth: 0,
    overrideAccess: true,
  })
  return isLeadOfDesk(typedUser, brief?.channel)
}
