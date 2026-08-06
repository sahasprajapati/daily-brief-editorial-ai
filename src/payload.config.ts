import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from './payload/collections/users'
import { EditorialBriefs } from './payload/collections/editorial-briefs'
import { BriefItems } from './payload/collections/brief-items'
import { Providers } from './payload/collections/providers'
import { CollectedItems } from './payload/collections/collected-items'
import { GeneratedPieces } from './payload/collections/generated-pieces'
import { PieceAssignments } from './payload/collections/piece-assignments'
import { QaVerdicts } from './payload/collections/qa-verdicts'
import { BriefFiles } from './payload/collections/brief-files'
import { ChannelConfigs } from './payload/collections/channel-configs'
import { NewsHqSettings } from './payload/globals/news-hq-settings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  collections: [
    Users,
    EditorialBriefs,
    BriefItems,
    Providers,
    CollectedItems,
    GeneratedPieces,
    PieceAssignments,
    QaVerdicts,
    BriefFiles,
    ChannelConfigs,
  ],
  globals: [NewsHqSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
})
