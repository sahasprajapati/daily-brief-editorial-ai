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
    {
      name: 'managerNote',
      type: 'textarea',
      admin: {
        description:
          'Set when a manager sends a piece back — shown to the editor as the reason. Latest note only, overwritten on the next send-back.',
      },
    },
    { name: 'managerNoteBy', type: 'relationship', relationTo: 'users' },
    { name: 'managerNoteAt', type: 'date' },
  ],
  timestamps: true,
}
