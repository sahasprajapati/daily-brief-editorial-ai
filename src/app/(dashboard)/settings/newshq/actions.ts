'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { checkIsAdmin } from '@/payload/access/admin'

export type SaveNewsHqSettingsState = { error: string | null; saved: boolean }

/** Every wire row is submitted as a paired `wireAgency` hidden input + a
 *  `wirePriority__<agency>` radio group (see NewsHqSettingsForm) - a wire whose radio group
 *  has nothing selected is left out of the saved list entirely (not searched), matching the
 *  schema's "no row = not searched" contract. */
function readWirePriorities(formData: FormData): Array<{ agency: string; priority: string }> {
  const agencies = formData.getAll('wireAgency').map(String).filter(Boolean)
  return agencies
    .map((agency) => ({ agency, priority: String(formData.get(`wirePriority__${agency}`) || '').trim() }))
    .filter((wire) => wire.priority)
}

async function checkAdminOrFail(): Promise<{ error: string } | { user: Awaited<ReturnType<typeof requireUser>> }> {
  const user = await requireUser()
  if (!checkIsAdmin(user)) return { error: 'Only admins can update NewsHQ settings.' }
  return { user }
}

/** Saves just the wire-priority box - the "Save wire priorities" button, ahead of the final
 *  "Save all settings" button at the bottom of the form. Both buttons submit the same form, so
 *  language/limit are present in formData here too, but this action ignores them. */
export async function saveNewsHqWirePriorities(
  _prev: SaveNewsHqSettingsState,
  formData: FormData,
): Promise<SaveNewsHqSettingsState> {
  const auth = await checkAdminOrFail()
  if ('error' in auth) return { error: auth.error, saved: false }

  const wirePriorities = readWirePriorities(formData)

  try {
    const payload = await getPayload({ config: configPromise })
    await payload.updateGlobal({
      slug: 'news-hq-settings',
      data: { wirePriorities },
      overrideAccess: false,
      user: auth.user,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save wire priorities.', saved: false }
  }

  revalidatePath('/settings/newshq')
  return { error: null, saved: true }
}

/** Saves everything - wire priorities plus the fallback language and results limit - via the
 *  "Save all settings" button at the very end of the form. */
export async function saveNewsHqSettings(
  _prev: SaveNewsHqSettingsState,
  formData: FormData,
): Promise<SaveNewsHqSettingsState> {
  const auth = await checkAdminOrFail()
  if ('error' in auth) return { error: auth.error, saved: false }

  const wirePriorities = readWirePriorities(formData)
  const language = String(formData.get('language') || 'en')
  const limit = Number(formData.get('limit') || 20)

  try {
    const payload = await getPayload({ config: configPromise })
    await payload.updateGlobal({
      slug: 'news-hq-settings',
      data: {
        wirePriorities,
        defaultLang: language,
        limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
      },
      overrideAccess: false,
      user: auth.user,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save settings.', saved: false }
  }

  revalidatePath('/settings/newshq')
  return { error: null, saved: true }
}
