/** Resolve NewsHQ API paths from NEWS_HQ_SEARCH_BASE_URL (host or full /api/v1/news URL). */

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
