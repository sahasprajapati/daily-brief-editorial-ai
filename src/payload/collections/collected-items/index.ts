import type { CollectionConfig } from 'payload'
import { leadOfDeskCollectedItemCreate, leadOfDeskCollectedItemUpdate } from '../../access/admin'

export const CollectedItems: CollectionConfig = {
  slug: 'collected-items',
  admin: {
    useAsTitle: 'headline',
    defaultColumns: ['headline', 'briefItem', 'reviewStatus', 'language'],
  },
  access: {
    read: () => true,
    create: leadOfDeskCollectedItemCreate,
    update: leadOfDeskCollectedItemUpdate,
    delete: leadOfDeskCollectedItemUpdate,
  },
  fields: [
    { name: 'briefItem', type: 'relationship', relationTo: 'brief-items', required: true, index: true },
    {
      name: 'groupKey',
      type: 'text',
      index: true,
      admin: { description: 'Same-story items from different providers share this key.' },
    },
    { name: 'headline', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'language', type: 'text', required: true },
    {
      name: 'reviewStatus',
      type: 'select',
      required: true,
      defaultValue: 'candidate',
      index: true,
      options: [
        { label: 'Candidate', value: 'candidate' },
        { label: 'Selected', value: 'selected' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: {
        description: 'NewsHQ hits start as candidates; editors select or reject each source.',
      },
    },
    {
      name: 'sources',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'provider', type: 'relationship', relationTo: 'providers', required: true },
        { name: 'providerItemId', type: 'text', required: true },
        { name: 'sourceUrl', type: 'text' },
        { name: 'publishTimestamp', type: 'date', required: true },
        { name: 'rawPayload', type: 'json' },
      ],
    },
  ],
  timestamps: true,
}
