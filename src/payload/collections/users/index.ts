import type { CollectionConfig } from 'payload'
import { adminOnly } from '../../access/admin'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role'],
  },
  access: {
    read: () => true,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: ['admin', 'editor'],
    },
    {
      name: 'leadOfDesks',
      type: 'text',
      hasMany: true,
      admin: { description: 'External cms-prod channel ids this user leads. Empty = leads nothing.' },
    },
  ],
}
