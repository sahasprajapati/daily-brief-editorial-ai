import type { CollectionConfig } from 'payload'
import { adminOnly, leadOfDeskBriefCreate, leadOfDeskBriefUpdate } from '../../access/admin'

/** Desks/channels are owned by trt-global-cms-prod, not this app - `channel` stores the
 *  external channel id (fetched via src/lib/cms-client), never a local relationship. */
export const EditorialBriefs: CollectionConfig = {
  slug: 'editorial-briefs',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'channelName', 'status', 'version'],
  },
  access: {
    read: () => true,
    create: leadOfDeskBriefCreate,
    update: leadOfDeskBriefUpdate,
    delete: adminOnly,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'channel', type: 'text', required: true, index: true },
    { name: 'channelName', type: 'text' },
    { name: 'uploadedBy', type: 'relationship', relationTo: 'users', required: true },
    {
      name: 'sourceType',
      type: 'select',
      required: true,
      options: ['paste', 'docx', 'pdf'],
    },
    {
      name: 'sourceFile',
      type: 'relationship',
      relationTo: 'brief-files',
      admin: { description: 'Unused — original PDF/DOCX files are not stored; only extracted text is kept.' },
    },
    {
      name: 'rawText',
      type: 'textarea',
      required: true,
      admin: { description: 'The exact text that was parsed — pasted or extracted client-side from a PDF/DOCX.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'parsed', 'confirmed', 'superseded'],
    },
    {
      name: 'rawParseSnapshot',
      type: 'json',
      admin: { description: 'Immutable snapshot of the first LLM parse, captured before any lead edits.' },
    },
    { name: 'version', type: 'number', required: true, defaultValue: 1 },
    { name: 'previousVersion', type: 'relationship', relationTo: 'editorial-briefs' },
    { name: 'confirmedBy', type: 'relationship', relationTo: 'users' },
    { name: 'confirmedAt', type: 'date' },
  ],
  timestamps: true,
}
