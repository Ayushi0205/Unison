import { slugify } from './slugify'

/** Anchor menu built from an article's section headings. Hidden when there are fewer than two. */
export function OnThisPage({ headings }: { headings: string[] }) {
  if (headings.length < 2) return null
  return (
    <nav className="mb-6 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
      <div className="text-[11px] tracking-wide uppercase text-gray-500 mb-1.5">In this article</div>
      <ul className="list-none p-0 m-0 space-y-1">
        {headings.map((h) => (
          <li key={h}>
            <a href={`#${slugify(h)}`} className="text-[13px] text-primary-strong hover:underline">
              {h}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
