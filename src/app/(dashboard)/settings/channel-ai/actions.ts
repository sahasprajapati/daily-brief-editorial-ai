'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { checkIsAdmin, isLeadOfDesk } from '@/payload/access/admin'

export type SaveChannelAiSettingsState = { error: string | null; saved: boolean }

export async function saveChannelAiSettings(
  _prev: SaveChannelAiSettingsState,
  formData: FormData,
): Promise<SaveChannelAiSettingsState> {
  const user = await requireUser()

  const channelId = String(formData.get('channelId') || '')
  if (!channelId) return { error: 'No channel selected.', saved: false }

  if (!checkIsAdmin(user) && !isLeadOfDesk(user, channelId)) {
    return {
      error: 'You can only update AI instructions for channels you lead.',
      saved: false,
    }
  }

  // One hidden input per instruction (see InstructionBoxList) - getAll collects the whole list.
  const extraQaInstructions = formData
    .getAll('qaInstructions')
    .map((value) => String(value).trim())
    .filter(Boolean)
  const extraWritingInstructions = formData
    .getAll('writingInstructions')
    .map((value) => String(value).trim())
    .filter(Boolean)
  // Major file slots (see MajorFileSlot) - name+text hidden inputs, both empty when removed.
  const majorQaFileName = String(formData.get('majorQaFileName') || '').trim()
  const majorQaFileText = String(formData.get('majorQaFileText') || '').trim()
  const majorInstructionsFileName = String(formData.get('majorInstructionsFileName') || '').trim()
  const majorInstructionsFileText = String(formData.get('majorInstructionsFileText') || '').trim()

  const data = {
    extraQaInstructions,
    extraWritingInstructions,
    majorQaFileName,
    majorQaFileText,
    majorInstructionsFileName,
    majorInstructionsFileText,
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const existing = await payload.find({
      collection: 'channel-configs',
      where: { channel: { equals: channelId } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs[0]) {
      await payload.update({
        collection: 'channel-configs',
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      })
    } else {
      // No channel-configs doc yet for this channel — create a minimal one. `language` is
      // required by the schema; editable later via /admin along with erLang/guidelineSlug.
      await payload.create({
        collection: 'channel-configs',
        data: { channel: channelId, language: 'English', ...data },
        overrideAccess: true,
      })
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save channel AI instructions.', saved: false }
  }

  revalidatePath('/settings/channel-ai')
  return { error: null, saved: true }
}
