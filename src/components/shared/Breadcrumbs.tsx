import { Link } from 'react-router-dom'

export interface BreadcrumbItem {
  label: string
  // If present → renders as a link to this path. If absent → renders as current-page text.
  to?: string
}

/**
 * Breadcrumb trail used at the top of detail and editor pages.
 *
 * Matches the designer's spec (`Screenshot_6.39.36`):
 * - Forward-slash separator
 * - Parent links: muted gray, underline on hover
 * - Current page (last item, no `to`): slightly darker gray, not bold
 * - Subtle bottom divider for visual separation from the title row
 *
 */
export function Breadcrumbs({ items }: { items: ReadonlyArray<BreadcrumbItem> }) {
  return (
    <nav aria-label="Breadcrumb" className="pb-3 border-b border-gray-100">
      <ol className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} className="flex items-center gap-2 min-w-0">
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-gray-700 hover:underline truncate">
                  {item.label}
                </Link>
              ) : (
                <span className={`truncate ${isLast ? 'text-gray-700' : ''}`}>{item.label}</span>
              )}
              {!isLast && <span className="text-gray-400 shrink-0">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
