import type { CollectionConfig } from 'payload'
import { adminOnly, ownAssignedVerdictCreate } from '../../access/admin'

export const QaVerdicts: CollectionConfig = {
  slug: 'qa-verdicts',
  admin: {
    defaultColumns: ['piece', 'verdict', 'okfVersion', 'submittedAt'],
  },
  access: {
    read: () => true,
    create: ownAssignedVerdictCreate,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'piece',
      type: 'relationship',
      relationTo: 'generated-pieces',
      required: true,
      index: true,
      admin: { description: 'Not unique - a piece accumulates one verdict per QA run, preserving history.' },
    },
    {
      name: 'pieceBodySnapshot',
      type: 'json',
      required: true,
      admin: { description: 'ContentBlock[] as it stood when this verdict was issued.' },
    },
    { name: 'verdict', type: 'select', required: true, options: ['goodToGo', 'needsAttention', 'rejected'] },
    {
      name: 'okfVersion',
      type: 'text',
      required: true,
      admin: { description: 'Git ref/tag of the okf-ruleset bundle that ran, e.g. a commit sha or tag.' },
    },
    {
      name: 'flags',
      type: 'array',
      fields: [
        {
          name: 'blockId',
          type: 'text',
          required: true,
          admin: { description: 'The ContentBlock this flag applies to - never the document as a whole.' },
        },
        { name: 'rule', type: 'text', required: true },
        { name: 'severity', type: 'select', required: true, options: ['hardFail', 'softFail'] },
        { name: 'message', type: 'text', required: true },
      ],
    },
    {
      name: 'suggestions',
      type: 'array',
      admin: {
        description:
          'Docs-style QA notes: highlight quote + message for editors. Separate from automated flags.',
      },
      fields: [
        { name: 'quote', type: 'text', required: true },
        { name: 'message', type: 'textarea', required: true },
        {
          name: 'severity',
          type: 'select',
          required: true,
          defaultValue: 'softFail',
          options: ['softFail', 'hardFail'],
        },
        {
          name: 'blockId',
          type: 'text',
          required: true,
          admin: { description: 'Hidden from QA UI — anchors the highlight to a ContentBlock.' },
        },
        { name: 'startOffset', type: 'number', required: true },
        { name: 'endOffset', type: 'number', required: true },
        { name: 'createdAt', type: 'date', required: true },
      ],
    },
    { name: 'submittedBy', type: 'relationship', relationTo: 'users', required: true },
    { name: 'submittedAt', type: 'date', required: true },
    { name: 'overridden', type: 'checkbox', defaultValue: false },
    {
      name: 'overrideJustification',
      type: 'textarea',
      admin: { condition: (data) => Boolean(data?.overridden) },
    },
    { name: 'overriddenBy', type: 'relationship', relationTo: 'users' },
    { name: 'overriddenAt', type: 'date' },
  ],
  timestamps: true,
}
