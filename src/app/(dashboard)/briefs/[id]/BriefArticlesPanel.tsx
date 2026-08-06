import Link from 'next/link'

export type BriefArticleRow = {
  id: string
  headline: string
  topic?: string
  attributionString?: string
  createdAt?: string
}

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
      <ul className="nhq-source-list">
        {articles.map((article) => (
          <li key={article.id} className="nhq-source-row">
            <div className="nhq-source-main">
              <div className="nhq-source-headline">{article.headline}</div>
              <div className="nhq-source-meta" style={{ marginTop: '0.35rem' }}>
                {article.topic && <span>{article.topic}</span>}
                {article.attributionString && <span>· {article.attributionString}</span>}
                {article.createdAt && (
                  <span>· {new Date(article.createdAt).toLocaleString()}</span>
                )}
              </div>
            </div>
            <div className="nhq-source-actions">
              <Link href={`/pieces/${article.id}`} className="btn-primary">
                View article
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
