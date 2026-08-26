import type { CollectionConfig } from 'payload'
import { adminOnly, leadOfDeskPieceCreate, ownAssignedPieceUpdate } from '../../access/admin'

/** Content is an array of src/lib/content-diff ContentBlocks, not Payload richText,
 *  and versioning is NOT Payload's native drafts - `generatedSnapshot` (immutable) and
 *  `currentBody` (the editor's live state) are explicit named fields instead, because a QA
 *  flag needs to address one stable blockId and reviewers need exactly two fixed states, not
 *  a raw autosave timeline. See the brainstorming notes on why Payload versioning didn't fit. */
export const GeneratedPieces: CollectionConfig = {
  slug: 'generated-pieces',
  admin: {
    defaultColumns: ['collectedItem', 'channelName', 'sourceOnly'],
  },
  access: {
    read: () => true,
    create: leadOfDeskPieceCreate,
    update: ownAssignedPieceUpdate,
    delete: adminOnly,
  },
  fields: [
    { name: 'collectedItem', type: 'relationship', relationTo: 'collected-items', required: true, index: true },
    {
      name: 'brief',
      type: 'relationship',
      relationTo: 'editorial-briefs',
      required: true,
      index: true,
      admin: { description: 'Denormalized from collectedItem.briefItem.brief for cheap full-chain traceability.' },
    },
    { name: 'channel', type: 'text', required: true, index: true },
    { name: 'channelName', type: 'text' },
    {
      name: 'generatedSnapshot',
      type: 'json',
      admin: { description: 'ContentBlock[] as first generated - immutable once written.' },
    },
    {
      name: 'currentBody',
      type: 'json',
      admin: { description: "ContentBlock[] - the editor's live, mutable working copy." },
    },
    { name: 'attributionString', type: 'text', required: true },
    { name: 'sourceOnly', type: 'checkbox', defaultValue: false },
    {
      name: 'restrictionReason',
      type: 'text',
      admin: { condition: (data) => Boolean(data?.sourceOnly), description: 'Shown when sourceOnly is set.' },
    },
    { name: 'publishedAt', type: 'date' },
    {
      name: 'cmsPackageId',
      type: 'text',
      admin: { description: 'The id createArticle() returned from trt-global-cms-prod. Unused while CMS publish is stubbed.' },
    },
    {
      name: 'coverImageDataUrl',
      type: 'text',
      // Payload's text fields default to a 40k-char maxLength (config.defaultMaxTextLength) -
      // a base64 data: URI for a single 1024x1024 image is ~2-3M chars, so that default rejects
      // every real image. 10M chars (~7.5MB binary) covers normal image sizes with headroom
      // under MongoDB's 16MB document limit.
      maxLength: 10_000_000,
      admin: {
        description:
          'data: URI of the generated cover image (see src/lib/cover-image) - placeholder storage via OpenAI image generation until a real asset pipeline / Atlas AI replaces it.',
      },
    },
    { name: 'coverImagePrompt', type: 'text' },
    { name: 'coverImageGeneratedAt', type: 'date' },
  ],
  timestamps: true,
}
