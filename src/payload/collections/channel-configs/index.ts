import type { CollectionConfig } from 'payload'
import { adminOnly } from '../../access/admin'

/** Operational config the collection/generation pipeline needs that neither cms-prod nor
 *  `providers` has: what language to generate in, Event Registry's language code for this
 *  desk, and which okf-ruleset guideline file (if any) applies. Unlike channel identity
 *  (name/language, owned by cms-prod), this is pipeline-specific - it belongs here. */
export const ChannelConfigs: CollectionConfig = {
  slug: 'channel-configs',
  admin: {
    useAsTitle: 'channel',
    defaultColumns: ['channel', 'channelName', 'language', 'guidelineSlug'],
  },
  access: {
    read: () => true,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: 'channel', type: 'text', required: true, unique: true, index: true },
    { name: 'channelName', type: 'text' },
    {
      name: 'language',
      type: 'text',
      required: true,
      admin: { description: "e.g. 'English', 'Russian' - the language generation writes in." },
    },
    {
      name: 'erLang',
      type: 'text',
      admin: { description: "Event Registry language code, e.g. 'eng', 'rus'." },
    },
    {
      name: 'guidelineSlug',
      type: 'text',
      admin: {
        description:
          'Matches a filename under okf-ruleset/guidelines/ (without .md). Empty = no desk-specific guideline.',
      },
    },
  ],
  timestamps: true,
}
