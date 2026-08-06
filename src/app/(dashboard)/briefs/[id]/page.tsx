import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { diffBriefItems, type DiffableBriefItem } from '@/lib/brief-diff'
import {
  latestPieceIdByBriefItem,
  toBriefArticleRows,
} from '@/lib/briefs/pieces'
import type { CollectedItem, GeneratedPiece } from '@/payload-types'
import { BriefItemsForm } from './BriefItemsForm'
import { BriefStepper } from './BriefStepper'
import { BriefTabs } from './BriefTabs'
import { BriefArticlesPanel } from './BriefArticlesPanel'
import { SourcesStep } from './SourcesStep'
import { GenerateStep } from './GenerateStep'
import type { SourceHit } from './SourceReviewPanel'

function resolveTab(requested: string | undefined): 'workflow' | 'articles' {
  return requested === 'articles' ? 'articles' : 'workflow'
}

function resolveStep(
  requested: string | undefined,
  confirmed: boolean,
  hasSources: boolean,
): 1 | 2 | 3 {
  const n = Number(requested)
  if (n === 3 && confirmed && hasSources) return 3
  if (n === 2 && confirmed) return 2
  if (n === 1) return 1
  if (confirmed && hasSources && n !== 2) return 3
  if (confirmed) return 2
  return 1
}

export default async function BriefReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ step?: string; tab?: string }>
}) {
  const { id } = await params
  const { step: stepParam, tab: tabParam } = await searchParams
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  let brief
  try {
    brief = await payload.findByID({ collection: 'editorial-briefs', id, overrideAccess: false, user })
  } catch {
    notFound()
  }
  if (!brief) notFound()

  const items = await payload.find({
    collection: 'brief-items',
    where: { brief: { equals: id } },
    sort: 'priorityOrder',
    limit: 100,
    overrideAccess: false,
    user,
  })

  let collectedDocs: CollectedItem[] = []
  if (items.docs.length > 0) {
    const collected = await payload.find({
      collection: 'collected-items',
      where: { briefItem: { in: items.docs.map((item) => item.id) } },
      limit: 500,
      sort: '-createdAt',
      overrideAccess: false,
      user,
    })
    collectedDocs = collected.docs
  }

  const piecesResult = await payload.find({
    collection: 'generated-pieces',
    where: { brief: { equals: id } },
    sort: '-createdAt',
    limit: 100,
    depth: 2,
    overrideAccess: false,
    user,
  })
  const pieces = piecesResult.docs as GeneratedPiece[]

  const sourcesByItemId: Record<string, SourceHit[]> = {}
  for (const hit of collectedDocs) {
    const briefItemId = typeof hit.briefItem === 'string' ? hit.briefItem : hit.briefItem.id
    const raw = hit.sources[0]?.rawPayload as {
      source?: string
      date?: string
      priority?: string | number
    } | null
    const status = hit.reviewStatus as string
    const mapped: SourceHit = {
      id: hit.id,
      headline: hit.headline,
      body: hit.body,
      language: hit.language,
      reviewStatus:
        status === 'kept' || status === 'selected'
          ? 'selected'
          : status === 'rejected'
            ? 'rejected'
            : 'candidate',
      agency: raw?.source,
      publishedAt: hit.sources[0]?.publishTimestamp ?? raw?.date,
      priority: raw?.priority,
    }
    ;(sourcesByItemId[briefItemId] ??= []).push(mapped)
  }

  const topics = items.docs.map((item) => ({
    briefItemId: item.id,
    topic: item.topic,
    sectionTitle: item.sectionTitle ?? undefined,
    format: item.format ?? undefined,
    hits: sourcesByItemId[item.id] ?? [],
  }))

  const topicByItemId = Object.fromEntries(items.docs.map((item) => [item.id, item.topic]))
  const pieceIdByBriefItem = latestPieceIdByBriefItem(pieces)
  const articles = toBriefArticleRows(pieces, topicByItemId)

  const hasSources = topics.some((t) => t.hits.some((h) => h.reviewStatus !== 'rejected'))
  const confirmed = brief.status === 'confirmed'
  const tab = resolveTab(tabParam)
  const step = resolveStep(stepParam, confirmed, hasSources)
  const generateTopics = topics.map((topic) => ({
    briefItemId: topic.briefItemId,
    topic: topic.topic,
    hits: topic.hits.filter((h) => h.reviewStatus !== 'rejected'),
    pieceId: pieceIdByBriefItem[topic.briefItemId],
  }))

  const currentItems = items.docs.map((item) => ({
    id: item.id,
    topic: item.topic,
    sectionTitle: item.sectionTitle ?? '',
    format: item.format ?? '',
    angle: item.angle ?? '',
    priorityOrder: item.priorityOrder ?? 0,
    region: item.region ?? '',
    keywords: item.keywords ?? [],
    exclusions: item.exclusions ?? [],
    sentiment: item.sentiment ?? '',
    portrayalNotes: item.portrayalNotes ?? '',
    bannedTerms: item.bannedTerms ?? [],
    requiredContext: item.requiredContext ?? '',
  }))

  const originalItems = (brief.rawParseSnapshot ?? []) as DiffableBriefItem[]
  const diffEntries = diffBriefItems(originalItems, currentItems)

  return (
    <div className="page">
      <h1>{brief.title}</h1>
      <p className="subtitle">
        <span className="channel-chip" style={{ marginBottom: 0 }}>
          Desk · {brief.channelName ?? brief.channel}
        </span>{' '}
        <span className="badge">{brief.status}</span> — version {brief.version}
        {brief.sourceType && <> — source: {brief.sourceType}</>}
      </p>

      <BriefTabs briefId={brief.id} tab={tab} articleCount={articles.length} />

      {tab === 'articles' ? (
        <BriefArticlesPanel briefId={brief.id} articles={articles} />
      ) : (
        <>
          <BriefStepper
            briefId={brief.id}
            step={step}
            confirmed={confirmed}
            hasSources={hasSources}
          />

          {step === 1 && (
            <>
              {!confirmed && (
                <div className="banner banner-warn" style={{ marginBottom: '1rem' }}>
                  Confirm the parse before searching NewsHQ sources.
                </div>
              )}
              <BriefItemsForm
                briefId={brief.id}
                briefStatus={brief.status}
                initialItems={currentItems}
                diffEntries={diffEntries}
              />
            </>
          )}

          {step === 2 && <SourcesStep briefId={brief.id} topics={topics} />}

          {step === 3 && <GenerateStep briefId={brief.id} topics={generateTopics} />}
        </>
      )}
    </div>
  )
}
