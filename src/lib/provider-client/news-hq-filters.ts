import axios from 'axios'
import { resolveNewsHqFiltersUrl } from './news-hq-url'

export interface NewsHqFilters {
  languages: string[]
  agencies: string[]
  priorities: string[]
  /** Agencies available per NewsHQ language code. */
  providersByLanguage: Record<string, string[]>
}

interface FiltersResponse {
  languages?: {
    values?: string[]
    providers?: Array<{ language: string; providers: string[] }>
  }
  agencies?: { values?: string[] }
  priorities?: { values?: string[] }
}

export async function fetchNewsHqFilters(
  envUrl = process.env.NEWS_HQ_SEARCH_BASE_URL,
): Promise<NewsHqFilters> {
  const url = resolveNewsHqFiltersUrl(envUrl)
  const { data } = await axios.get<FiltersResponse>(url, {
    timeout: 30000,
    headers: { Accept: 'application/json' },
  })

  const providersByLanguage: Record<string, string[]> = {}
  for (const row of data.languages?.providers ?? []) {
    providersByLanguage[row.language] = row.providers ?? []
  }

  return {
    languages: data.languages?.values ?? [],
    agencies: data.agencies?.values ?? [],
    priorities: data.priorities?.values ?? [],
    providersByLanguage,
  }
}
