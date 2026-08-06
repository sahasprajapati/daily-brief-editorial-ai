import type { CollectionConfig } from 'payload'
import { adminOnly, leadOfDeskFileCreate } from '../../access/admin'

/** Stores the original uploaded .docx/.pdf for a brief, for audit - local disk storage, no
 *  S3/cloud adapter configured anywhere in this app. `channel` here is only used by the create
 *  access check (leadOfDeskFileCreate); it is not otherwise read back. */
export const BriefFiles: CollectionConfig = {
  slug: 'brief-files',
  admin: {
    useAsTitle: 'filename',
  },
  access: {
    read: () => true,
    create: leadOfDeskFileCreate,
    update: adminOnly,
    delete: adminOnly,
  },
  upload: {
    staticDir: 'brief-files',
    mimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  fields: [{ name: 'channel', type: 'text', required: true, index: true }],
  timestamps: true,
}
