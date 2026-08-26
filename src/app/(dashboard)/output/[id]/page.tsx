import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import type { GeneratedPiece } from '@/payload-types'
import { toBriefArticleRows } from '@/lib/briefs/pieces'
import { ArticleGrid } from '../../ArticleGrid'

/** Read-only view of one day's finished editorial output, reached only from the dashboard -
 *  deliberately outside /briefs, which is for uploading/editing briefs, not for viewing what
 *  came out of them. No upload affordance here, no link back into the brief workflow. */
export default async function EditorialOutputPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
    limit: 100,
    overrideAccess: false,
    user,
  })
  const topicByItemId = Object.fromEntries(items.docs.map((item) => [item.id, item.topic]))

  const piecesResult = await payload.find({
    collection: 'generated-pieces',
    where: { brief: { equals: id } },
    sort: '-createdAt',
    limit: 100,
    overrideAccess: false,
    user,
  })
  const articles = toBriefArticleRows(piecesResult.docs as GeneratedPiece[], topicByItemId)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{brief.title}</h1>
          <p className="subtitle">
            {new Date(brief.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · {articles.length} article{articles.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link href="/" className="btn-secondary page-header-btn">
          Back to dashboard
        </Link>
      </div>

      <div className="card">
        {articles.length === 0 ? (
          <p style={{ margin: 0 }}>No articles here anymore.</p>
        ) : (
          <ArticleGrid articles={articles} />
        )}
      </div>
    </div>
  )
}
