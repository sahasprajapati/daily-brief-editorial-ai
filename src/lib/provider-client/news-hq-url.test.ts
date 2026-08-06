import { describe, expect, test } from 'bun:test'
import { resolveNewsHqBaseUrl, resolveNewsHqFiltersUrl, toNewsHqLang } from './news-hq-url'

describe('news-hq-url', () => {
  test('appends /api/v1/news to a host base', () => {
    expect(resolveNewsHqBaseUrl('https://prod-assethq-newshq-api.trtglobal.io')).toBe(
      'https://prod-assethq-newshq-api.trtglobal.io/api/v1/news',
    )
  })

  test('does not double-append when path already present', () => {
    expect(resolveNewsHqBaseUrl('https://host/api/v1/news/')).toBe('https://host/api/v1/news')
  })

  test('filters URL is under the news endpoint', () => {
    expect(resolveNewsHqFiltersUrl('https://host')).toBe('https://host/api/v1/news/filters')
  })

  test('maps desk language labels to NewsHQ lang codes', () => {
    expect(toNewsHqLang('Russian')).toBe('ru')
    expect(toNewsHqLang('rus')).toBe('ru')
    expect(toNewsHqLang('English', 'ru')).toBe('en')
  })
})
