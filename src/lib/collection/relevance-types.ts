import type { NormalizedProviderItem } from '@/lib/provider-client'

export type RelevanceCandidate = Pick<
  NormalizedProviderItem,
  'providerItemId' | 'headline' | 'body' | 'source'
>
