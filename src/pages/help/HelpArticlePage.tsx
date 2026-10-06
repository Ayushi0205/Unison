import { useParams, Navigate, Link } from 'react-router-dom'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { getArticle, FIRST_ARTICLE_ID } from '../../data/help'
import { HelpArticleRenderer } from '../../components/help/HelpArticleRenderer'

export function HelpArticlePage() {
  const { articleId } = useParams()
  const { user } = useCurrentUser()
  const article = articleId ? getArticle(articleId) : undefined

  if (!article) {
    return (
      <div className="max-w-[600px]">
        <h1 className="text-primary-strong text-2xl font-semibold mb-2">Article not found</h1>
        <p className="text-gray-600 text-sm">
          That help topic doesn’t exist.{' '}
          <Link className="text-primary-strong hover:underline" to={`/help/${FIRST_ARTICLE_ID}`}>
            Go to the start
          </Link>
          .
        </p>
      </div>
    )
  }

  // A user who reaches an admin-only article by URL is sent back to the start.
  if (!article.roles.includes(user.role)) {
    return <Navigate to={`/help/${FIRST_ARTICLE_ID}`} replace />
  }

  return <HelpArticleRenderer article={article} />
}
