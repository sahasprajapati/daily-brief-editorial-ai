import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { checkIsAdmin } from '@/payload/access/admin'
import { fetchNewsHqFilters } from '@/lib/provider-client/news-hq-filters'
import { NewsHqSettingsForm } from './NewsHqSettingsForm'

export default async function NewsHqSettingsPage() {
  const user = await requireUser()
  if (!checkIsAdmin(user)) redirect('/')

  const payload = await getPayload({ config: configPromise })
  const settings = await payload.findGlobal({ slug: 'news-hq-settings', overrideAccess: true })

  let filters = {
    languages: ['en', 'ru', 'ar', 'tr', 'fr', 'es', 'de'],
    agencies: ['Reuters', 'AnadoluAgency', 'AFP', 'AP', 'TRTHaber'],
    priorities: ['1', '2', '3', '4', '5', '6'],
  }
  try {
    const live = await fetchNewsHqFilters()
    filters = {
      languages: live.languages.length ? live.languages : filters.languages,
      agencies: live.agencies.length ? live.agencies : filters.agencies,
      priorities: live.priorities.length ? live.priorities : filters.priorities,
    }
  } catch (err) {
    // Falls back to the hardcoded lists above - this is a routine "provider unreachable in
    // local dev" case, not something an editor/lead needs surfaced in the UI.
    console.warn('[settings/newshq] falling back to default NewsHQ filter options:', err)
  }

  const wirePriorities = (settings.wirePriorities ?? []).filter(
    (wire): wire is { agency: string; priority: string; id?: string | null } =>
      Boolean(wire.agency && wire.priority),
  )
  // A wire already configured with a priority stays visible even if it's since dropped out of
  // the live NewsHQ filter list - otherwise saving would silently drop it.
  const savedAgencies = wirePriorities.map((wire) => wire.agency)
  const agencies = [...new Set([...filters.agencies, ...savedAgencies])]

  return (
    <div className="page page-wide">
      <h1>Sources</h1>
      <p className="subtitle">Wire sources and search defaults used when collecting brief items.</p>
      <NewsHqSettingsForm
        agencies={agencies}
        priorities={filters.priorities}
        languages={filters.languages}
        wirePriorities={wirePriorities}
        language={settings.defaultLang || 'en'}
        limit={settings.limit ?? 20}
      />
    </div>
  )
}
