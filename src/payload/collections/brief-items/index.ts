import type { CollectionConfig } from 'payload'
import { leadOfDeskBriefItemCreate, leadOfDeskBriefItemUpdate } from '../../access/admin'
import { assertBriefConfirmed } from './hooks/assertBriefConfirmed'

/** One row per topic in a confirmed brief. Fields mirror the real extraction schema already
 *  proven in the trt-editorial-n8n prototype (news_items + coverage_policies), not invented -
 *  see trt-editorial-n8n/trt-daily-editorial.json, node "Extract Brief". */
export const BriefItems: CollectionConfig = {
  slug: 'brief-items',
    admin: {
      useAsTitle: 'topic',
      defaultColumns: ['topic', 'sectionTitle', 'format', 'brief', 'priorityOrder', 'status'],
    },
  access: {
    read: () => true,
    create: leadOfDeskBriefItemCreate,
    update: leadOfDeskBriefItemUpdate,
    delete: leadOfDeskBriefItemUpdate,
  },
  hooks: {
    beforeChange: [assertBriefConfirmed],
  },
  fields: [
    { name: 'brief', type: 'relationship', relationTo: 'editorial-briefs', required: true, index: true },
    { name: 'topic', type: 'text', required: true },
    {
      name: 'sectionTitle',
      type: 'text',
      index: true,
      admin: {
        description:
          'Bold section header from the brief (e.g. INTERNATIONAL NEWS, GAZA & PALESTINE).',
      },
    },
    {
      name: 'format',
      type: 'text',
      admin: {
        description: 'Piece format from the brief (News, Video, Infographic, Op-Ed, Feature, …).',
      },
    },
    { name: 'keywords', type: 'text', hasMany: true },
    { name: 'angle', type: 'text' },
    { name: 'priorityOrder', type: 'number' },
    { name: 'region', type: 'text' },
    {
      name: 'exclusions',
      type: 'text',
      hasMany: true,
      admin: { description: 'Angles or sub-topics to leave uncovered.' },
    },
    { name: 'sentiment', type: 'text' },
    { name: 'portrayalNotes', type: 'textarea' },
    {
      name: 'bannedTerms',
      type: 'text',
      hasMany: true,
      admin: { description: 'Specific words/phrases the piece must not use.' },
    },
    { name: 'requiredContext', type: 'textarea' },
    {
      name: 'query',
      type: 'text',
      admin: { description: 'The normalized query string sent to providers for this item.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'queried', 'no-results', 'error'],
    },
    { name: 'lastQueryRunAt', type: 'date' },
  ],
  timestamps: true,
}
