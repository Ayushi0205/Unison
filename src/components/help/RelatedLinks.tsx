import { Link } from 'react-router-dom'

export function RelatedLinks({ links }: { links: { label: string; to: string }[] }) {
  return (
    <div className="mt-7 border-t border-gray-200 pt-4">
      <div className="text-[11px] tracking-wide uppercase text-gray-500 mb-2">Related</div>
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="block text-primary-strong font-medium text-[13.5px] py-0.5 no-underline hover:underline before:content-['→'] before:text-[#b9a9cd] before:mr-1.5"
        >
          {l.label}
        </Link>
      ))}
    </div>
  )
}
