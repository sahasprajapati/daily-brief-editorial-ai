import type { Payload } from 'payload'
import type { EditorialBrief, User } from '@/payload-types'
import type { ExtractedBriefItem } from '@/lib/brief-extraction'
import { createBriefItems } from './create-items'

export interface NewVersionInput {
  payload: Payload
  user: User
  previous: EditorialBrief
  items: ExtractedBriefItem[]
  rawParseSnapshot: unknown
  sourceType: 'paste' | 'docx' | 'pdf'
  sourceFile?: string
  rawText: string
  title: string
}

/** Supersedes `previous` and creates the next version as a fresh 'parsed' draft - shared by
 *  both the duplicate-upload "replace" choice (Task 11) and re-editing an already-confirmed
 *  brief (Task 12), since both need the exact same version-chain mechanics. */
export async function createNextBriefVersion(input: NewVersionInput): Promise<EditorialBrief> {
  const { payload, user, previous, items, rawParseSnapshot, sourceType, sourceFile, rawText, title } = input

  await payload.update({
    collection: 'editorial-briefs',
    id: previous.id,
    data: { status: 'superseded' },
    overrideAccess: false,
    user,
  })

  const brief = await payload.create({
    collection: 'editorial-briefs',
    data: {
      title,
      channel: previous.channel,
      channelName: previous.channelName,
      uploadedBy: user.id,
      status: 'parsed',
      rawParseSnapshot: rawParseSnapshot as EditorialBrief['rawParseSnapshot'],
      sourceType,
      sourceFile,
      rawText,
      version: previous.version + 1,
      previousVersion: previous.id,
    },
    overrideAccess: false,
    user,
  })

  await createBriefItems(payload, user, brief.id, items)

  return brief
}
