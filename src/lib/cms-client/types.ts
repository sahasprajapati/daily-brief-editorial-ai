export interface CmsClientConfig {
  baseUrl: string
  apiKey: string
}

export interface CmsChannel {
  id: string
  name: string
  languageCode: string
  language: string
}

export interface CmsContentSearchResult {
  id: string
  title: string
  slug?: string
  publishedAt?: string
}

export interface CreateArticleInput {
  title: string
  description?: string
  paragraphs: string[]
}

export interface CreateArticleResult {
  packageId: string
  contentId: string | undefined
}
