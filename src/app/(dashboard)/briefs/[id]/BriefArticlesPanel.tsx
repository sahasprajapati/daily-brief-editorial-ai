import Link from 'next/link'
import { ArticleGrid, type ArticleRow } from '../../ArticleGrid'

export type BriefArticleRow = ArticleRow

export function BriefArticlesPanel({
  briefId,
  articles,
}: {
  briefId: string
  articles: BriefArticleRow[]
}) {
  if (articles.length === 0) {
    return (
      <div className="card">
        <h2>Articles</h2>
        <p className="subtitle">
          No articles generated for this brief yet. Use the Workflow tab to search sources and generate.
        </p>
        <Link href={`/briefs/${briefId}?tab=workflow&step=3`} className="btn-primary">
          Go to generate
        </Link>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Articles</h2>
      <p className="subtitle">Generated pieces for this brief.</p>
      <ArticleGrid articles={articles} />
    </div>
  )
}
