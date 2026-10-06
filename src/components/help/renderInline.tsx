import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Interprets the small markdown subset used in help content strings:
 *   - **bold**            → strong (used for exact UI labels)
 *   - [label](/help/x)    → in-app link (React Router)
 *   - [label](https://…)  → external link (new tab)
 * Everything else is passed through as text.
 */
export function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>)
    if (m[1] !== undefined) {
      nodes.push(<strong key={key++} className="font-bold text-[#2a2f38]">{m[1]}</strong>)
    } else {
      const label = m[2]
      const href = m[3]
      nodes.push(
        href.startsWith('http') ? (
          <a key={key++} href={href} target="_blank" rel="noreferrer" className="text-primary-strong hover:underline">{label}</a>
        ) : (
          <Link key={key++} to={href} className="text-primary-strong hover:underline">{label}</Link>
        ),
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(<Fragment key={key}>{text.slice(last)}</Fragment>)
  return nodes
}
