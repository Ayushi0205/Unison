import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { HELP_GROUPS, HELP_ARTICLES } from '../../data/help'

/** Left table of contents: grouped, filtered to the current role, with a title filter. */
export function HelpNav() {
  const { user } = useCurrentUser()
  const [filter, setFilter] = useState('')

  const visible = HELP_ARTICLES.filter((a) => a.roles.includes(user.role))
  const q = filter.trim().toLowerCase()
  const matches = q ? visible.filter((a) => a.title.toLowerCase().includes(q)) : visible

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 pr-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter topics…"
        className="w-full mb-3 px-2.5 py-1.5 text-[12.5px] border border-gray-200 rounded-md focus:outline-none focus:border-primary-strong"
      />
      {HELP_GROUPS.map((g) => {
        const items = matches.filter((a) => a.group === g.id)
        if (items.length === 0) return null
        return (
          <div key={g.id} className="mb-3">
            <div className="text-[10px] tracking-wide uppercase text-gray-400 px-2 mb-1">{g.title}</div>
            {items.map((a) => (
              <NavLink
                key={a.id}
                to={`/help/${a.id}`}
                className={({ isActive }) =>
                  `block px-2 py-1.5 rounded-md text-[12.5px] no-underline ${
                    isActive ? 'bg-primary-tint text-primary-strong font-semibold' : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                {a.title}
              </NavLink>
            ))}
          </div>
        )
      })}
      {matches.length === 0 && <div className="text-[12px] text-gray-400 px-2">No topics match “{filter}”.</div>}
    </aside>
  )
}
