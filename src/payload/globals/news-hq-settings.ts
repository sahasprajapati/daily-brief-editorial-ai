import type { GlobalConfig } from 'payload'
import { adminOnly } from '../access/admin'

/** Singleton NewsHQ search defaults — not per-channel. Option lists come from
 *  GET /api/v1/news/filters; base URL stays in NEWS_HQ_SEARCH_BASE_URL. */
export const NewsHqSettings: GlobalConfig = {
  slug: 'news-hq-settings',
  label: 'NewsHQ Settings',
  access: {
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'agencies',
      type: 'text',
      hasMany: true,
      admin: {
        description:
          'Wire agencies to include (values from NewsHQ /filters). Empty = all agencies for the search language.',
      },
    },
    {
      name: 'priorities',
      type: 'text',
      hasMany: true,
      defaultValue: ['1', '2', '3', '4'],
      admin: { description: 'NewsHQ priority filter values, e.g. 1,2,3,4.' },
    },
    {
      name: 'defaultLang',
      type: 'text',
      defaultValue: 'en',
      admin: { description: 'Fallback NewsHQ lang when the desk has no language mapping.' },
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 5,
      admin: {
        description:
          'Max sources kept per topic after ranking + LLM (capped at 5). NewsHQ is queried with limit 50 across multiple keyword layers.',
      },
    },
  ],
}
