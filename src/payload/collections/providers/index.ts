import type { CollectionConfig } from 'payload'
import { adminOnly } from '../../access/admin'

/** Config consumed by src/lib/provider-client's collectFromProviders() - adding or
 *  disabling a provider instance is an edit here, no deploy. Adding a new provider *type*
 *  still needs a matching adapter in src/lib/provider-client/adapters/. */
export const Providers: CollectionConfig = {
  slug: 'providers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'enabled'],
  },
  access: {
    read: () => true,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'TRT NewsHQ Search', value: 'newsHq' },
        { label: 'Event Registry', value: 'eventRegistry' },
      ],
    },
    { name: 'enabled', type: 'checkbox', defaultValue: true },
    { name: 'baseUrl', type: 'text', required: true },
    {
      name: 'agencies',
      type: 'text',
      hasMany: true,
      admin: { condition: (data) => data?.type === 'newsHq', description: 'Wire agencies to include.' },
    },
    {
      name: 'apiKeyEnvVar',
      type: 'text',
      admin: {
        condition: (data) => data?.type === 'eventRegistry',
        description: 'Name of the env var holding the API key - never store the key itself here.',
      },
    },
    {
      name: 'channels',
      type: 'text',
      hasMany: true,
      admin: {
        description:
          'External cms-prod channel ids this provider serves. Empty = all channels (typical for global NewsHQ).',
      },
    },
  ],
  timestamps: true,
}
