'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { checkIsAdmin } from '@/payload/access/admin'

export type SaveNewsHqSettingsState = { error: string | null; saved: boolean }

export async function saveNewsHqSettings(
  _prev: SaveNewsHqSettingsState,
  formData: FormData,
): Promise<SaveNewsHqSettingsState> {
  const user = await requireUser()
  if (!checkIsAdmin(user)) {
    return { error: 'Only admins can update NewsHQ settings.', saved: false }
  }

  const agencies = formData.getAll('agencies').map(String).filter(Boolean)
  const priorities = formData.getAll('priorities').map(String).filter(Boolean)
  const defaultLang = String(formData.get('defaultLang') || 'en')
  const limit = Number(formData.get('limit') || 20)

  try {
    const payload = await getPayload({ config: configPromise })
    await payload.updateGlobal({
      slug: 'news-hq-settings',
      data: {
        agencies,
        priorities: priorities.length > 0 ? priorities : ['1', '2', '3', '4'],
        defaultLang,
        limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
      },
      overrideAccess: false,
      user,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save settings.', saved: false }
  }

  revalidatePath('/settings/newshq')
  return { error: null, saved: true }
}
