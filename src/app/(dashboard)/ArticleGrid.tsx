import Link from 'next/link'

export type ArticleRow = {
  id: string
  headline: string
  topic?: string
  attributionString?: string
  createdAt?: string
  coverImageDataUrl?: string | null
}

function ArticleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4.5h11l3 3V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </svg>
  )
}

/** Pure grid of article cards (cover image or a document icon, title beneath) - shared by the
 *  brief's Articles tab and the dashboard's read-only output view, so the two pages can have
 *  their own copy/empty-states around it without duplicating the card markup. */
export function ArticleGrid({ articles }: { articles: ArticleRow[] }) {
  return (
    <div className="article-grid">
      {articles.map((article) => (
        <Link key={article.id} href={`/pieces/${article.id}`} className="article-card">
          <span className="article-card-media">
            {article.coverImageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- base64 data: URI, not an optimizable remote asset
              <img src={article.coverImageDataUrl} alt="" />
            ) : (
              <ArticleIcon />
            )}
          </span>
          <span className="article-card-body">
            <span className="article-card-title">{article.headline}</span>
            <span className="article-card-meta">
              {article.topic && <span>{article.topic}</span>}
              {article.topic && article.createdAt && <span className="dot" />}
              {article.createdAt && <span>{new Date(article.createdAt).toLocaleDateString()}</span>}
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}
