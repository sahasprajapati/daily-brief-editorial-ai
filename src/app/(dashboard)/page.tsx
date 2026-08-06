import Link from 'next/link'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import {
  groupPiecesByBrief,
  pieceHeadline,
} from '@/lib/briefs/pieces'
import type { GeneratedPiece, PieceAssignment } from '@/payload-types'
import { ClaimButton } from './ClaimButton'

const STATUS_LABEL: Record<string, string> = {
  claimed: 'Claimed',
  inProgress: 'In progress',
  inQA: 'In QA',
  verdictReached: 'Verdict reached',
  awaitingApproval: 'Awaiting approval',
  approved: 'Approved',
  published: 'Published',
}

export default async function DashboardPage() {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })
  const cookieStore = await cookies()
  const selectedChannel = cookieStore.get('selected-channel')?.value ?? 'all'

  const [allPieces, allAssignments, myAssignments] = await Promise.all([
    payload.find({
      collection: 'generated-pieces',
      where: selectedChannel === 'all' ? undefined : { channel: { equals: selectedChannel } },
      limit: 100,
      depth: 1,
      sort: '-createdAt',
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'piece-assignments',
      limit: 100,
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'piece-assignments',
      where: { assignedTo: { equals: user.id } },
      limit: 100,
      depth: 2,
      overrideAccess: false,
      user,
    }),
  ])

  const claimedPieceIds = new Set(
    allAssignments.docs.map((assignment) =>
      typeof assignment.piece === 'string' ? assignment.piece : assignment.piece.id,
    ),
  )
  const unclaimedPieces = allPieces.docs.filter((piece) => !claimedPieceIds.has(piece.id))
  const unclaimedGroups = groupPiecesByBrief(unclaimedPieces)

  const myFilteredAssignments =
    selectedChannel === 'all'
      ? myAssignments.docs
      : myAssignments.docs.filter((assignment) => {
          const piece = assignment.piece
          return typeof piece === 'object' && piece.channel === selectedChannel
        })

  const myPieces = myFilteredAssignments
    .map((assignment) => assignment.piece)
    .filter((piece): piece is GeneratedPiece => typeof piece === 'object' && piece !== null)
  const myGroups = groupPiecesByBrief(myPieces)
  const statusByPieceId = new Map(
    myFilteredAssignments.map((assignment) => {
      const pieceId =
        typeof assignment.piece === 'string' ? assignment.piece : assignment.piece.id
      return [pieceId, assignment.status] as const
    }),
  )

  return (
    <div className="page">
      <h1>TRT Newsroom AI</h1>
      <p className="subtitle">Signed in as {user.email}</p>

      <div className="card">
        <h2>Unclaimed pieces</h2>
        {unclaimedGroups.length === 0 ? (
          <p>Nothing waiting right now.</p>
        ) : (
          <div className="brief-piece-groups">
            {unclaimedGroups.map((group) => (
              <section key={group.briefId} className="brief-piece-group">
                <h3 className="brief-piece-group-title">
                  {group.briefId === 'unknown' ? (
                    group.briefTitle
                  ) : (
                    <Link href={`/briefs/${group.briefId}?tab=articles`}>{group.briefTitle}</Link>
                  )}
                  <span className="badge">{group.pieces.length}</span>
                </h3>
                <ul className="list">
                  {group.pieces.map((piece) => (
                    <li key={piece.id} className="list-item">
                      <span>
                        {pieceHeadline(piece)}
                        {piece.channelName ? ` — ${piece.channelName}` : ''}
                      </span>
                      <ClaimButton pieceId={piece.id} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2>My pieces</h2>
        {myGroups.length === 0 ? (
          <p>You haven&apos;t claimed anything yet.</p>
        ) : (
          <div className="brief-piece-groups">
            {myGroups.map((group) => (
              <section key={group.briefId} className="brief-piece-group">
                <h3 className="brief-piece-group-title">
                  {group.briefId === 'unknown' ? (
                    group.briefTitle
                  ) : (
                    <Link href={`/briefs/${group.briefId}?tab=articles`}>{group.briefTitle}</Link>
                  )}
                  <span className="badge">{group.pieces.length}</span>
                </h3>
                <ul className="list">
                  {group.pieces.map((piece) => (
                    <li key={piece.id} className="list-item">
                      <span>
                        {pieceHeadline(piece)}
                        {piece.channelName ? ` — ${piece.channelName}` : ''}
                      </span>
                      <span>
                        <span className="badge">
                          {STATUS_LABEL[statusByPieceId.get(piece.id) ?? 'claimed'] ??
                            statusByPieceId.get(piece.id) ??
                            'Claimed'}
                        </span>{' '}
                        <Link href={`/pieces/${piece.id}`}>Open</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
