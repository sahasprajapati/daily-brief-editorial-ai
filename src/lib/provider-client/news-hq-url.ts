/** Resolve NewsHQ API paths from NEWS_HQ_SEARCH_BASE_URL (host or full /api/v1/news URL). */

/** Sentinel baseUrl used when NEWS_HQ_SEARCH_BASE_URL isn't configured (e.g. local dev
 *  without TRT VPN/creds) — fetchNewsHqProvider recognizes it and returns canned wire
 *  items instead of making a real request, mirroring cms-client's isCmsStub(). */
export const NEWS_HQ_STUB_BASE_URL = 'stub://news-hq'

export function isNewsHqStub(baseUrl: string): boolean {
  return (
    !baseUrl ||
    baseUrl.startsWith('stub://') ||
    baseUrl.includes('example') ||
    process.env.NEWS_HQ_STUB === '1'
  )
}

export function resolveNewsHqBaseUrl(envUrl = process.env.NEWS_HQ_SEARCH_BASE_URL): string {
  const raw = (envUrl ?? '').trim().replace(/\/+$/, '')
  if (!raw) {
    throw new Error('NEWS_HQ_SEARCH_BASE_URL is not set.')
  }
  if (raw.endsWith('/api/v1/news')) return raw
  return `${raw}/api/v1/news`
}

export function resolveNewsHqFiltersUrl(envUrl = process.env.NEWS_HQ_SEARCH_BASE_URL): string {
  return `${resolveNewsHqBaseUrl(envUrl)}/filters`
}

/** Map desk language labels / Event Registry codes to NewsHQ `lang` query values. */
export function toNewsHqLang(input?: string | null, fallback = 'en'): string {
  if (!input) return fallback
  const v = input.trim().toLowerCase()
  const map: Record<string, string> = {
    en: 'en',
    eng: 'en',
    english: 'en',
    ar: 'ar',
    ara: 'ar',
    arabic: 'ar',
    tr: 'tr',
    tur: 'tr',
    turkish: 'tr',
    fr: 'fr',
    fra: 'fr',
    french: 'fr',
    es: 'es',
    spa: 'es',
    spanish: 'es',
    de: 'de',
    deu: 'de',
    german: 'de',
    ru: 'ru',
    rus: 'ru',
    russian: 'ru',
  }
  return map[v] ?? (v.length <= 4 ? v : fallback)
}
