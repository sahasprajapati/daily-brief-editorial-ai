import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { checkIsAdmin } from '@/payload/access/admin'
import { fetchNewsHqFilters } from '@/lib/provider-client/news-hq-filters'
import { resolveNewsHqBaseUrl } from '@/lib/provider-client/news-hq-url'
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
  let filtersError: string | null = null
  try {
    const live = await fetchNewsHqFilters()
    filters = {
      languages: live.languages.length ? live.languages : filters.languages,
      agencies: live.agencies.length ? live.agencies : filters.agencies,
      priorities: live.priorities.length ? live.priorities : filters.priorities,
    }
  } catch (err) {
    filtersError = err instanceof Error ? err.message : 'Could not load NewsHQ filters.'
  }

  let baseUrl = ''
  try {
    baseUrl = resolveNewsHqBaseUrl()
  } catch {
    baseUrl = ''
  }

  return (
    <div className="page page-wide">
      <h1>NewsHQ settings</h1>
      <p className="subtitle">
        Global search defaults for brief source collection. Option lists come from{' '}
        <code>/api/v1/news/filters</code>.
      </p>
      {filtersError && (
        <div className="banner banner-warn" style={{ marginBottom: '1rem' }}>
          Live filters unavailable ({filtersError}). Showing fallback options.
        </div>
      )}
      <NewsHqSettingsForm
        agencies={filters.agencies}
        priorities={filters.priorities}
        languages={filters.languages}
        selectedAgencies={settings.agencies ?? []}
        selectedPriorities={settings.priorities ?? ['1', '2', '3', '4']}
        defaultLang={settings.defaultLang || 'en'}
        limit={settings.limit ?? 20}
        baseUrl={baseUrl}
      />
    </div>
  )
}
