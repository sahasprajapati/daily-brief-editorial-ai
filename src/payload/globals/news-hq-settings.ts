import type { GlobalConfig } from 'payload'
import { adminOnly } from '../access/admin'

/** Singleton NewsHQ search defaults — not per-channel. Option lists come from
 *  GET /api/v1/news/filters; base URL stays in NEWS_HQ_SEARCH_BASE_URL. */
export const NewsHqSettings: GlobalConfig = {
  slug: 'news-hq-settings',
  label: 'Sources',
  access: {
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      // One row per wire the editor has assigned a priority to - a wire with no row is not
      // searched at all, *unless the array is empty entirely*, which falls back to searching
      // every agency at every priority (loadNewsHqSearchDefaults/collectForBriefItem). See
      // NewsHqSettingsForm - the "Save wire priorities" button writes just this field.
      name: 'wirePriorities',
      type: 'array',
      admin: {
        description:
          'Per-wire priority filter (values from NewsHQ /filters). A wire not listed here is not searched, unless the list is empty entirely - then every agency/priority is searched unrestricted.',
      },
      fields: [
        { name: 'agency', type: 'text', required: true },
        { name: 'priority', type: 'text', required: true },
      ],
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
      defaultValue: 10,
      admin: {
        description:
          'Max sources kept per topic after ranking + LLM (capped at 10). NewsHQ is queried with limit 50 across multiple keyword layers.',
      },
    },
  ],
}
