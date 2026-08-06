import axios, { type AxiosInstance } from 'axios'
import { plainTextToLexicalJSON } from './lexical'
import { SEEDED_CHANNELS } from './channels.seed'
import type {
  CmsChannel,
  CmsClientConfig,
  CmsContentSearchResult,
  CreateArticleInput,
  CreateArticleResult,
} from './types'

/** True when CMS_BASE_URL is unset or still the .env.example placeholder — all CMS
 *  calls use local stubs (channel seed, empty search, fake publish ids). */
export function isCmsStub(config: CmsClientConfig): boolean {
  const base = config.baseUrl?.trim() ?? ''
  return !base || base.includes('example') || process.env.CMS_STUB === '1'
}

function createHttpClient(config: CmsClientConfig): AxiosInstance {
  return axios.create({
    baseURL: config.baseUrl,
    // Payload API-key auth: "Authorization: <collection-slug> API-Key <key>".
    // `users` is the collection with `useAPIKey: true` in trt-global-cms-prod.
    headers: { Authorization: `users API-Key ${config.apiKey}` },
  })
}

export function createCmsClient(config: CmsClientConfig, httpClient?: AxiosInstance) {
  const stub = isCmsStub(config)
  const http = httpClient ?? createHttpClient(config)

  return {
    async listChannels(): Promise<CmsChannel[]> {
      if (stub) return SEEDED_CHANNELS
      try {
        const response = await http.get('/api/channels', { params: { limit: 100 } })
        return response.data.docs.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          languageCode: doc.languageCode,
          language: doc.language,
        }))
      } catch {
        return SEEDED_CHANNELS
      }
    },

    /** Dedup check before generating: has this desk already covered this topic? */
    async searchContent(
      query: string,
      options?: { channelId?: string; limit?: number },
    ): Promise<CmsContentSearchResult[]> {
      if (stub) return []
      const params: Record<string, string | number> = {
        limit: options?.limit ?? 5,
        'where[title][like]': query,
      }
      if (options?.channelId) {
        params['where[channel][equals]'] = options.channelId
      }

      const response = await http.get('/api/contents', { params })
      return response.data.docs.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        slug: doc.slug,
        publishedAt: doc.publishedTime,
      }))
    },

    /** Hits POST /api/packages/create. That endpoint infers the channel from the
     *  authenticated user's own `channels` field, not from this request body. */
    async createArticle(input: CreateArticleInput): Promise<CreateArticleResult> {
      if (stub) {
        return { packageId: `stub-${crypto.randomUUID()}`, contentId: undefined }
      }
      const response = await http.post('/api/packages/create', {
        title: input.title,
        description: input.description,
        content: plainTextToLexicalJSON(input.paragraphs),
      })
      return { packageId: response.data.id, contentId: response.data.contents?.[0] }
    },
  }
}

export type CmsClient = ReturnType<typeof createCmsClient>
