import { useState, useRef, useEffect } from 'react'
import { Avatar } from './Avatar'

interface Props {
  value: string
  onChange: (owner: string) => void
  owners: string[]
  emailToName: (email: string) => string
  // When provided, a "Created by me" entry appears at the top of the menu that
  // selects this email. Designer feedback (May 28 review).
  currentUserEmail?: string
}

export function OwnerFilter({ value, onChange, owners, emailToName, currentUserEmail }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = owners.filter((email) => {
    if (currentUserEmail && email === currentUserEmail) return false
    if (!query) return true
    const q = query.toLowerCase()
    return emailToName(email).toLowerCase().includes(q) || email.toLowerCase().includes(q)
  })

  const select = (email: string) => {
    onChange(email)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-10 border border-gray-300 rounded-md text-sm px-3 bg-white min-w-[160px] flex items-center gap-2 hover:bg-gray-50 transition-colors"
      >
        {value ? (
          <span className="flex items-center gap-2">
            <Avatar email={value} size="sm" />
            <span className="text-gray-900">{emailToName(value)}</span>
          </span>
        ) : (
          <span className="text-gray-500 italic">All owners</span>
        )}
        <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a person…"
              className="w-full h-8 text-sm border border-gray-200 rounded px-2 placeholder:italic focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            <button
              onClick={() => select('')}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!value ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-700'}`}
            >
              All owners
            </button>
            {currentUserEmail && (
              <button
                onClick={() => select(currentUserEmail)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 ${value === currentUserEmail ? 'bg-gray-50 font-medium' : ''}`}
              >
                <Avatar email={currentUserEmail} size="sm" />
                <span className="text-gray-900">Created by me</span>
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 italic">No matches</div>
            ) : (
              filtered.map((email) => (
                <button
                  key={email}
                  onClick={() => select(email)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${value === email ? 'bg-gray-50 font-medium' : ''}`}
                >
                  <Avatar email={email} size="sm" />
                  <span className="text-gray-900">{emailToName(email)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
