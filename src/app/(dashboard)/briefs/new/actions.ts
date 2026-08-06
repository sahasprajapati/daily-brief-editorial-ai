'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { checkIsAdmin, isLeadOfDesk } from '@/payload/access/admin'
import { extractBrief, EmptyBriefError } from '@/lib/brief-extraction'
import { createBriefItems } from '@/lib/briefs/create-items'
import { createNextBriefVersion } from '@/lib/briefs/versioning'

export type UploadBriefState = { error: string | null; duplicateOf: string | null }

export async function uploadBrief(_prev: UploadBriefState, formData: FormData): Promise<UploadBriefState> {
  const user = await requireUser()
  const channel = formData.get('channel') as string
  const channelName = (formData.get('channelName') as string) || undefined
  const title = formData.get('title') as string
  const pasteText = (formData.get('pasteText') as string) || ''
  const sourceTypeRaw = formData.get('sourceType') as string
  const duplicateChoice = formData.get('duplicateChoice') as 'replace' | 'parallel' | ''

  if (!channel || channel === 'all') return { error: 'Select a channel in the header first.', duplicateOf: null }
  if (!checkIsAdmin(user) && !isLeadOfDesk(user, channel)) {
    return { error: 'You cannot upload a brief for this channel.', duplicateOf: null }
  }

  const rawText = pasteText.trim()
  if (!rawText) {
    return { error: 'Paste the brief text or choose a file to extract text from.', duplicateOf: null }
  }

  const sourceType: 'paste' | 'docx' | 'pdf' =
    sourceTypeRaw === 'docx' || sourceTypeRaw === 'pdf' ? sourceTypeRaw : 'paste'

  const payload = await getPayload({ config: configPromise })

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const existing = await payload.find({
    collection: 'editorial-briefs',
    where: {
      and: [
        { channel: { equals: channel } },
        { status: { not_equals: 'superseded' } },
        { createdAt: { greater_than_equal: startOfDay.toISOString() } },
      ],
    },
    limit: 1,
    overrideAccess: false,
    user,
  })

  if (existing.docs.length > 0 && !duplicateChoice) {
    return { error: null, duplicateOf: existing.docs[0].id }
  }

  let items
  try {
    items = await extractBrief(rawText)
  } catch (err) {
    if (err instanceof EmptyBriefError) return { error: err.message, duplicateOf: null }
    console.error('[uploadBrief] extractBrief failed:', err)
    const detail = err instanceof Error ? err.message : 'Unknown error'
    if (/API key|GOOGLE_GENERATIVE_AI|Unauthenticated|401|403/i.test(detail)) {
      return { error: 'Could not parse this brief — set GOOGLE_GENERATIVE_AI_API_KEY in .env and restart.', duplicateOf: null }
    }
    if (/model|404|not found/i.test(detail)) {
      return { error: 'Could not parse this brief — Gemini model unavailable. Check model id / API access.', duplicateOf: null }
    }
    const short = detail.replace(/\s+/g, ' ').slice(0, 180)
    return { error: `Could not parse this brief: ${short}`, duplicateOf: null }
  }

  const briefTitle = title || `Brief ${new Date().toISOString().slice(0, 10)}`
  let briefId: string

  if (duplicateChoice === 'replace' && existing.docs.length > 0) {
    const nextVersion = await createNextBriefVersion({
      payload,
      user,
      previous: existing.docs[0],
      items,
      rawParseSnapshot: items,
      sourceType,
      rawText,
      title: briefTitle,
    })
    briefId = nextVersion.id
  } else {
    const brief = await payload.create({
      collection: 'editorial-briefs',
      data: {
        title: briefTitle,
        channel,
        channelName,
        uploadedBy: user.id,
        status: 'parsed',
        rawParseSnapshot: items,
        sourceType,
        rawText,
        version: 1,
      },
      overrideAccess: false,
      user,
    })
    await createBriefItems(payload, user, brief.id, items)
    briefId = brief.id
  }

  revalidatePath('/briefs')
  redirect(`/briefs/${briefId}`)
}
