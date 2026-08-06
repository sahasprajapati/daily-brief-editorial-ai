'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'

export async function claimPiece(pieceId: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    await payload.create({
      collection: 'piece-assignments',
      data: {
        piece: pieceId,
        assignedTo: user.id,
        status: 'claimed',
        claimedAt: new Date().toISOString(),
      },
      overrideAccess: false,
      user,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not claim this piece.' }
  }

  revalidatePath('/')
  return { error: null }
}
