import type { CollectionConfig } from 'payload'
import { adminOnly, leadOfDeskChannelConfigCreate, leadOfDeskChannelConfigUpdate } from '../../access/admin'

/** Operational config the collection/generation pipeline needs that neither cms-prod nor
 *  `providers` has: what language to generate in, Event Registry's language code for this
 *  desk, and which okf-ruleset guideline file (if any) applies. Unlike channel identity
 *  (name/language, owned by cms-prod), this is pipeline-specific - it belongs here. */
export const ChannelConfigs: CollectionConfig = {
  slug: 'channel-configs',
  admin: {
    useAsTitle: 'channel',
    defaultColumns: ['channel', 'channelName', 'language', 'guidelineSlug'],
  },
  access: {
    read: () => true,
    create: leadOfDeskChannelConfigCreate,
    update: leadOfDeskChannelConfigUpdate,
    delete: adminOnly,
  },
  fields: [
    { name: 'channel', type: 'text', required: true, unique: true, index: true },
    { name: 'channelName', type: 'text' },
    {
      name: 'language',
      type: 'text',
      required: true,
      admin: { description: "e.g. 'English', 'Russian' - the language generation writes in." },
    },
    {
      name: 'erLang',
      type: 'text',
      admin: { description: "Event Registry language code, e.g. 'eng', 'rus'." },
    },
    {
      name: 'guidelineSlug',
      type: 'text',
      admin: {
        description:
          'Matches a filename under okf-ruleset/guidelines/ (without .md). Empty = no desk-specific guideline.',
      },
    },
    {
      // The channel's primary QA reference doc, uploaded as a whole (see MajorFileSlot) -
      // text is extracted client-side at upload time, same as brief PDFs/DOCX (the original
      // file itself is never stored - matches brief-files' "extracted text only" convention).
      // Prepended ahead of extraQaInstructions wherever this gets joined into a prompt.
      name: 'majorQaFileName',
      type: 'text',
    },
    {
      name: 'majorQaFileText',
      type: 'textarea',
    },
    {
      name: 'majorInstructionsFileName',
      type: 'text',
    },
    {
      name: 'majorInstructionsFileText',
      type: 'textarea',
    },
    {
      // One entry per instruction, not one blob of text - the settings UI (/settings/channel-ai)
      // renders each as its own editable/deletable card. Joined with newlines at the point each
      // one is injected into a prompt - see src/app/(dashboard)/pieces/[id]/actions.ts.
      name: 'extraQaInstructions',
      type: 'text',
      hasMany: true,
      admin: {
        description:
          'Channel-specific additions to the general okf-ruleset QA checks - the AI QA verdict judges against the general checks plus these. Does not replace the general rules.',
      },
    },
    {
      name: 'extraWritingInstructions',
      type: 'text',
      hasMany: true,
      admin: {
        description:
          'Channel-specific additions to the general desk guideline - article generation writes against the general guideline plus these. Does not replace the general rules.',
      },
    },
  ],
  timestamps: true,
}
