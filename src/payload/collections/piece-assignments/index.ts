import type { CollectionConfig } from 'payload'
import { adminOnly, ownAssignmentUpdate, selfClaimOnly } from '../../access/admin'
import { assertClaimAvailable } from './hooks/beforeChange'

export const PieceAssignments: CollectionConfig = {
  slug: 'piece-assignments',
  admin: {
    defaultColumns: ['piece', 'assignedTo', 'status'],
  },
  access: {
    read: () => true,
    create: selfClaimOnly,
    update: ownAssignmentUpdate,
    delete: adminOnly,
  },
  hooks: {
    beforeChange: [assertClaimAvailable],
  },
  fields: [
    { name: 'piece', type: 'relationship', relationTo: 'generated-pieces', required: true, unique: true, index: true },
    { name: 'assignedTo', type: 'relationship', relationTo: 'users', required: true },
    {
      name: 'assignedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Empty when the editor self-claimed rather than being assigned by a manager.' },
    },
    { name: 'previousAssignee', type: 'relationship', relationTo: 'users' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'claimed',
      options: [
        'claimed',
        'inProgress',
        'inQA',
        'verdictReached',
        'awaitingApproval',
        'approved',
        'published',
      ],
    },
    { name: 'claimedAt', type: 'date', required: true, defaultValue: () => new Date().toISOString() },
  ],
  timestamps: true,
}
