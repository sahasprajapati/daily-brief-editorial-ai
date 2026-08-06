import { createCmsClient, type CmsClient } from './client'

let instance: CmsClient | undefined

export function getCmsClient(): CmsClient {
  if (!instance) {
    instance = createCmsClient({
      baseUrl: process.env.CMS_BASE_URL || '',
      apiKey: process.env.CMS_API_KEY || '',
    })
  }
  return instance
}
